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
# 5. iptables (既存): 80/443/5678 ACCEPT は n8n 運用で必要、既存設定を維持
#    具体的な iptables 設定はこのサーバーに既に適用済み (initial setup 時)
# ==========================================================================

log "setup.sh complete"
