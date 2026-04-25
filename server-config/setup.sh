#!/usr/bin/env bash
# n8n-server OCI インスタンスのサーバーセットアップスクリプト
#
# 実行:
#   ssh ubuntu@161.33.22.52 'cd /home/ubuntu/n8n-server && git pull && bash server-config/setup.sh'
#
# このスクリプトは冪等に書く。既に適用済みの項目は no-op で終わること。
# OS 状態を変更する全ての操作はここに集約する。SSH で直接 apt install 等を叩くのは禁止
# (PreToolUse hook guard-ssh-infra.py が物理ブロック)。
set -euo pipefail

log() { echo "[setup] $*"; }

# ==========================================================================
# 1. 不要パッケージの削除: rpcbind (NFS portmapper、外部 LISTEN 111 を閉塞)
# ==========================================================================
if dpkg -l 2>/dev/null | grep -q '^ii  rpcbind'; then
  log "Purging rpcbind"
  sudo systemctl stop rpcbind rpcbind.socket 2>/dev/null || true
  sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y rpcbind
else
  log "rpcbind already absent"
fi

# ==========================================================================
# 2. fail2ban: SSH ブルートフォース対策 (5 failures/10min → 1h ban)
# ==========================================================================
if ! dpkg -l 2>/dev/null | grep -q '^ii  fail2ban'; then
  log "Installing fail2ban"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -qqy fail2ban
fi

F2B_JAIL=/etc/fail2ban/jail.d/sshd.local
F2B_EXPECTED='[sshd]
enabled = true
port = 22
maxretry = 5
findtime = 10m
bantime = 1h'

if [ ! -f "$F2B_JAIL" ] || ! sudo diff -q "$F2B_JAIL" <(echo "$F2B_EXPECTED") >/dev/null 2>&1; then
  log "Writing $F2B_JAIL"
  echo "$F2B_EXPECTED" | sudo tee "$F2B_JAIL" > /dev/null
  sudo systemctl enable --now fail2ban
  sudo systemctl restart fail2ban
fi

# ==========================================================================
# 3. sshd ハードニング: X11Forwarding / PermitRootLogin を明示的に無効化
#    ファイル内容を比較し、期待値と異なる場合のみ書き換える（手動改変も元に戻す）
# ==========================================================================
SSHD_HARDENING=/etc/ssh/sshd_config.d/99-hardening.conf
SSHD_EXPECTED='X11Forwarding no
PermitRootLogin no'

if [ ! -f "$SSHD_HARDENING" ] || ! sudo diff -q "$SSHD_HARDENING" <(echo "$SSHD_EXPECTED") >/dev/null 2>&1; then
  log "Writing $SSHD_HARDENING"
  echo "$SSHD_EXPECTED" | sudo tee "$SSHD_HARDENING" > /dev/null
  if sudo sshd -t; then
    sudo systemctl reload sshd
  else
    log "ERROR: sshd config invalid, reverting"
    sudo rm -f "$SSHD_HARDENING"
    exit 1
  fi
fi

# ==========================================================================
# 4. unattended-upgrades (自動セキュリティパッチ): 未インストールなら install、
#    非アクティブなら enable --now
# ==========================================================================
if ! dpkg -l 2>/dev/null | grep -q '^ii  unattended-upgrades'; then
  log "Installing unattended-upgrades"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -qqy unattended-upgrades
fi

if ! systemctl is-active --quiet unattended-upgrades; then
  log "Enabling unattended-upgrades"
  sudo systemctl enable --now unattended-upgrades
fi

# ==========================================================================
# 5. Automatic-Reboot: カーネル更新後の reboot を自動化 (04:00 JST)
#    n8n は docker-compose の restart: always で自動復帰、SSL cert も時刻非依存
# ==========================================================================
APT_CUSTOM=/etc/apt/apt.conf.d/52unattended-upgrades-local
APT_EXPECTED='Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Automatic-Reboot-WithUsers "true";'
if [ ! -f "$APT_CUSTOM" ] || ! sudo diff -q "$APT_CUSTOM" <(echo "$APT_EXPECTED") >/dev/null 2>&1; then
  log "Writing $APT_CUSTOM"
  echo "$APT_EXPECTED" | sudo tee "$APT_CUSTOM" > /dev/null
else
  log "$APT_CUSTOM already configured"
fi

# ==========================================================================
# 6. Timezone: JST (Automatic-Reboot-Time は local time 解釈のため必須)
# ==========================================================================
CURRENT_TZ=$(timedatectl show --property=Timezone --value)
if [ "$CURRENT_TZ" != "Asia/Tokyo" ]; then
  log "Setting timezone to Asia/Tokyo (was $CURRENT_TZ)"
  sudo timedatectl set-timezone Asia/Tokyo
else
  log "Timezone already Asia/Tokyo"
fi

# ==========================================================================
# 7. iptables (既存): 80/443/5678 ACCEPT は n8n 運用で必要、既存設定を維持
#    具体的な iptables 設定はこのサーバーに既に適用済み (initial setup 時)
# ==========================================================================

# ==========================================================================
# 8. Nginx 設定の同期: server-config/nginx-n8n.conf を
#    /etc/nginx/sites-available/n8n に反映。差分があれば構文チェック後 reload。
#    これまで手動コピーが必要でリポと実機のドリフトが発生していた (2026-03-20 NFB)。
#    構文エラー時は自動でバックアップに戻して reload しない (サービス無停止保証)。
# ==========================================================================
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
NGINX_SRC="$SCRIPT_DIR/nginx-n8n.conf"
NGINX_DST=/etc/nginx/sites-available/n8n
if [ -f "$NGINX_SRC" ]; then
  if ! sudo diff -q "$NGINX_SRC" "$NGINX_DST" >/dev/null 2>&1; then
    log "Syncing nginx-n8n.conf → $NGINX_DST"
    NGINX_BAK=""
    # 既存設定があればバックアップ (初回はバックアップ不要)
    if sudo test -f "$NGINX_DST"; then
      NGINX_BAK="${NGINX_DST}.bak.$(date +%s)"
      sudo cp -a "$NGINX_DST" "$NGINX_BAK"
    fi
    sudo cp "$NGINX_SRC" "$NGINX_DST"
    if sudo nginx -t; then
      sudo systemctl reload nginx
      [ -n "$NGINX_BAK" ] && sudo rm -f "$NGINX_BAK"
    else
      if [ -n "$NGINX_BAK" ]; then
        log "ERROR: nginx config invalid, rolling back from $NGINX_BAK"
        sudo cp -a "$NGINX_BAK" "$NGINX_DST"
        sudo rm -f "$NGINX_BAK"
      else
        log "ERROR: nginx config invalid on initial install, removing $NGINX_DST"
        sudo rm -f "$NGINX_DST"
      fi
      exit 1
    fi
  else
    log "nginx config already in sync"
  fi
fi

# ==========================================================================
# 9. docker compose up -d: server-config/docker-compose.yml のサービスを起動/更新
#    --pull always で latest タグ利用サービスの最新 image 取得も兼ねる
# ==========================================================================
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
if [ -f "$COMPOSE_FILE" ]; then
  log "docker compose up -d --pull always (file: $COMPOSE_FILE)"
  # set -e で失敗時に即 exit するが、ログで明示的に失敗を示すため明示チェック。
  if ! sudo docker compose -f "$COMPOSE_FILE" up -d --pull always; then
    log "ERROR: docker compose up failed"
    exit 1
  fi
fi

log "setup.sh complete"
