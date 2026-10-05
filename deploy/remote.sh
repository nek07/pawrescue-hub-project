#!/usr/bin/env bash
# Выполняется НА СЕРВЕРЕ из /opt/pawrescue/deploy (его вызывает deploy.sh).
# Идемпотентен: при первом запуске создаёт .env с секретами, дальше только обновляет стек.
set -euo pipefail
cd "$(dirname "$0")"

SEED=0
[[ "${1:-}" == "--seed" ]] && SEED=1

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# 1. .env с секретами — один раз, дальше не трогаем
if [[ ! -f .env ]]; then
  log "Создаю .env со случайными секретами"
  secret() { openssl rand -hex 32; }
  sed \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(secret)/" \
    -e "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(secret)/" \
    -e "s/^SESSION_SECRET=.*/SESSION_SECRET=$(secret)/" \
    -e "s/^S3_ACCESS_KEY=.*/S3_ACCESS_KEY=paw$(openssl rand -hex 8)/" \
    -e "s/^S3_SECRET_KEY=.*/S3_SECRET_KEY=$(secret)/" \
    .env.example > .env
  chmod 600 .env
fi
set -a; source .env; set +a

# 2. Права SeaweedFS из ключей в .env (анониму — только чтение фото)
cat > s3.json <<JSON
{
  "identities": [
    {
      "name": "paw",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    },
    { "name": "anonymous", "actions": ["Read:pet-photos"] }
  ]
}
JSON
chmod 644 s3.json

# 3. Сборка и запуск. migrate применяет миграции до старта api и worker.
log "Собираю образы и запускаю стек"
docker compose up -d --build --remove-orphans

# Caddyfile смонтирован файлом: после rsync (новый inode) контейнер видит старую
# версию, поэтому при изменении конфига Caddy пересоздаётся
caddy_sum=$(sha256sum Caddyfile | cut -d' ' -f1)
if [[ "$(cat .caddyfile.sha 2>/dev/null)" != "$caddy_sum" ]]; then
  log "Caddyfile изменился — перезапускаю Caddy"
  docker compose up -d --force-recreate caddy
  echo "$caddy_sum" > .caddyfile.sha
fi

# 4. Бакеты: в prod API их не создаёт (это задача инфраструктуры)
log "Проверяю бакеты S3"
docker compose exec -T api python - <<'PY'
import asyncio
from app.core.config import get_settings
from app.core.storage import get_storage
s = get_settings()
asyncio.run(get_storage().ensure_buckets(s.s3_uploads_bucket, s.s3_photos_bucket, s.s3_docs_bucket))
PY

if [[ $SEED == 1 ]]; then
  log "Загружаю демо-данные (идемпотентно)"
  docker compose exec -T api python -m app.seed
fi

# 5. Проверка снаружи, через Caddy и HTTPS
log "Проверяю https://${SITE_DOMAIN}"
for i in $(seq 1 30); do
  # API проверяем изнутри (снаружи он закрыт), сайт — снаружи через Caddy
  if docker compose exec -T api python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" >/dev/null 2>&1 \
     && curl -fsS -o /dev/null "https://${SITE_DOMAIN}/"; then
    log "Готово: https://${SITE_DOMAIN}"
    docker image prune -f >/dev/null
    docker compose ps --format 'table {{.Service}}\t{{.Status}}'
    exit 0
  fi
  sleep 4
done
echo "Сайт не ответил за 2 минуты. Логи: docker compose logs --tail 100 caddy api web" >&2
docker compose ps
exit 1
