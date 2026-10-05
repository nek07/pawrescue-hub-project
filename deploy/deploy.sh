#!/usr/bin/env bash
# Деплой с локальной машины: ./deploy/deploy.sh [--seed] [--ref <git-ref>]
#
# Выкатывает ЗАКОММИЧЕННОЕ состояние (по умолчанию HEAD), а не рабочую копию —
# незакоммиченные правки на сервер не попадают. Нужен SSH-доступ по ключу.
set -euo pipefail

HOST="${DEPLOY_HOST:-root@93.170.73.79}"
DIR="/opt/pawrescue"
REF="HEAD"
SEED=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) SEED="--seed"; shift ;;
    --ref) REF="$2"; shift 2 ;;
    *) echo "Использование: $0 [--seed] [--ref <git-ref>]" >&2; exit 2 ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
SHA=$(git rev-parse --short "$REF")
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Внимание: есть незакоммиченные изменения — они НЕ попадут на сервер (деплою $SHA)."
fi

echo "==> Отправляю $SHA на $HOST:$DIR"
# Код распаковывается во временную папку и синхронизируется с --delete,
# но .env, s3.json и бэкапы на сервере не трогаются.
git archive --format=tar "$REF" | ssh "$HOST" "
  set -e
  tmp=\$(mktemp -d)
  tar -x -C \$tmp
  echo $SHA > \$tmp/REVISION
  mkdir -p $DIR
  rsync -a --delete \
    --exclude 'deploy/.env' --exclude 'deploy/s3.json' --exclude 'deploy/.caddyfile.sha' --exclude 'backups/' \
    \$tmp/ $DIR/
  rm -rf \$tmp
"

ssh "$HOST" "bash $DIR/deploy/remote.sh $SEED"
