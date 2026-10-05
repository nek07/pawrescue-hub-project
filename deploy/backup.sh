#!/usr/bin/env bash
# Ежедневный дамп БД (cron: /etc/cron.d/pawrescue-backup). Хранит последние 14.
# Восстановление:
#   docker compose exec -T postgres pg_restore -U paw -d paw --clean --if-exists < backups/paw-ДАТА.dump
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../backups
file="../backups/paw-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T postgres pg_dump -U paw -d paw -Fc > "$file.tmp"
mv "$file.tmp" "$file"
ls -1t ../backups/paw-*.dump | tail -n +15 | xargs -r rm --
