#!/usr/bin/env bash
# Первичная настройка чистого Ubuntu 22.04+ (один раз, от root):
#   ssh root@<ip> 'bash -s' < deploy/server-setup.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

# Swap: сборка Next.js не помещается в 2 ГБ RAM
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf && sysctl -p /etc/sysctl.d/99-swap.conf

apt-get -o DPkg::Lock::Timeout=600 update -qq
apt-get -o DPkg::Lock::Timeout=600 install -y -qq ca-certificates curl ufw fail2ban unattended-upgrades rsync
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

# Firewall: SSH и HTTP(S). Docker публикует только порты Caddy.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# fail2ban: бан IP на час после 5 неудачных входов по SSH.
# backend=systemd — на минимальных образах нет rsyslog и /var/log/auth.log
cat > /etc/fail2ban/jail.local <<'JAIL'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
bantime  = 1h
JAIL
systemctl enable fail2ban
systemctl restart fail2ban

# Ежедневный бэкап БД в 03:30
cat > /etc/cron.d/pawrescue-backup <<'CRON'
30 3 * * * root /opt/pawrescue/deploy/backup.sh >> /var/log/pawrescue-backup.log 2>&1
CRON

echo "Сервер готов. Дальше с локальной машины: ./deploy/deploy.sh --seed"
