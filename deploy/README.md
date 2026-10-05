# Деплой Paw Rescue Hub

Весь стек работает на одном сервере в Docker Compose. Наружу открыт только Caddy:
он сам получает и продлевает HTTPS-сертификаты Let's Encrypt.

```
                       ┌──────────── сервер 93.170.73.79 ─────────────────────────┐
 браузер ── HTTPS ──▶  │ Caddy :443 ─┬─ /*      ──▶ web (Next.js) ──▶ api ──▶ postgres │
                       │             ├─ /api/v1/auth/{google,telegram} ─▶ api    redis    │
                       │             └─ s3.*    ──▶ s3 (SeaweedFS) ◀── worker (arq) │
                       └───────────────────────────────────────────────────────────┘
```

| Сервис     | Что делает                                                      |
|------------|-----------------------------------------------------------------|
| `caddy`    | reverse-proxy, HTTPS, HTTP/3, gzip/zstd, security-заголовки      |
| `web`      | Next.js (standalone-сборка)                                     |
| `api`      | FastAPI + WebSocket чата                                        |
| `worker`   | arq: ресайз фото в WebP, уведомления                            |
| `migrate`  | `alembic upgrade head` при каждом деплое, затем завершается     |
| `postgres` | PostgreSQL 17, данные в volume `pgdata`                         |
| `redis`    | очередь, pub/sub, rate-limit; с паролем и AOF                   |
| `s3`       | SeaweedFS: `uploads`, `shelter-docs` — приватные, `pet-photos` — публичные |

**Адреса**
- Сайт: https://93-170-73-79.sslip.io
- S3: https://s3.93-170-73-79.sslip.io

`sslip.io` — бесплатный DNS, который отдаёт IP прямо из имени. Свой домен подключается так:
A-записи `example.kz` и `s3.example.kz` → IP сервера, затем `SITE_DOMAIN=example.kz`
в `.env` на сервере и `./deploy/deploy.sh`.

## Деплой

```bash
./deploy/deploy.sh            # выкатить текущий коммит (HEAD)
./deploy/deploy.sh --seed     # + демо-данные (идемпотентно)
./deploy/deploy.sh --ref main # выкатить другую ветку или коммит
```

Скрипт отправляет на сервер **закоммиченный** код (`git archive`), поэтому незакоммиченные
правки в прод не попадут. Дальше на сервере `remote.sh` собирает образы, применяет
миграции, перезапускает изменённые сервисы и проверяет, что сайт отвечает по HTTPS.
Выкаченный коммит записан в `/opt/pawrescue/REVISION`.

## Новый сервер с нуля

```bash
ssh-copy-id root@<ip>                                # вход по ключу
ssh root@<ip> 'bash -s' < deploy/server-setup.sh     # swap, Docker, ufw, fail2ban, cron бэкапов
DEPLOY_HOST=root@<ip> ./deploy/deploy.sh --seed
```

Первый запуск создаёт `/opt/pawrescue/deploy/.env` из `.env.example` и заполняет его
случайными паролями. Этот файл не хранится в git, а следующие деплои его не трогают.

## Настройки (`/opt/pawrescue/deploy/.env`)

| Переменная | Значение |
|---|---|
| `APP_ENV` | `prod`: вход только через Google/Telegram. `dev`: демо, включён вход без пароля под любой ролью |
| `NEXT_PUBLIC_DEV_LOGIN` | `1` — показать форму демо-входа (вшивается при сборке web) |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth-клиент Google, redirect URI: `https://<домен>/api/v1/auth/google/callback` |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_ID` | бот для входа, в @BotFather: `/setdomain` → домен сайта |

Сейчас сервер работает в **демо-режиме** (`APP_ENV=dev`, `NEXT_PUBLIC_DEV_LOGIN=1`).
Перед запуском для реальных пользователей пропишите ключи Google/Telegram, поставьте
`APP_ENV=prod`, очистите `NEXT_PUBLIC_DEV_LOGIN` и запустите `./deploy/deploy.sh`.

## Эксплуатация

Все команды выполняются на сервере в `/opt/pawrescue/deploy`:

```bash
docker compose ps                          # состояние сервисов
docker compose logs -f --tail 100 api      # логи (api | web | worker | caddy | ...)
docker compose restart api                 # перезапуск сервиса
docker compose exec postgres psql -U paw   # консоль БД
docker compose exec api python -m app.seed # демо-данные
```

**Бэкапы.** Cron каждый день в 03:30 делает `pg_dump` в `/opt/pawrescue/backups`
и хранит последние 14 дампов. Сделать бэкап вручную: `./backup.sh`. Восстановить:

```bash
docker compose exec -T postgres pg_restore -U paw -d paw --clean --if-exists \
  < ../backups/paw-YYYYMMDD-HHMM.dump
```

Фото и документы лежат в volume `pawrescue_s3data` и в этот бэкап не входят.

**Что открыто снаружи.** Только сайт (Next.js) и S3-поддомен: фото и загрузка по
presigned URL с подписью. API, Swagger (`/docs`) и `/openapi.json` отвечают 404:
Next.js обращается к API по внутренней сети Docker. Напрямую из браузера доступны
только эндпоинты входа: `/api/v1/auth/google/login`, `/api/v1/auth/google/callback`
и `/api/v1/auth/telegram`. Если фронт начнёт вызывать новый эндпоинт из браузера
(например, WebSocket чата), его нужно явно добавить в `@public_api` в `Caddyfile`.
Postgres и Redis не публикуют порты вообще.

Swagger для разработки открывается через SSH-туннель: API слушает порт 8000 только
на loopback сервера (`127.0.0.1`).
`ssh -N -L 8000:127.0.0.1:8000 root@93.170.73.79`, затем http://localhost:8000/docs.

**Безопасность.** ufw пропускает только порты 22, 80 и 443. fail2ban защищает SSH.
Postgres, Redis и S3 недоступны снаружи, логи контейнеров ротируются (5 × 10 МБ).
