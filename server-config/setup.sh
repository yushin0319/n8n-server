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
if [ ! -f "$F2B_JAIL" ] || ! grep -q "maxretry = 5" "$F2B_JAIL" 2>/dev/null; then
  log "Writing $F2B_JAIL"
  sudo tee "$F2B_JAIL" > /dev/null <<'JAIL'
[sshd]
enabled = true
port = 22
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
  sudo systemctl enable --now fail2ban
  sudo systemctl restart fail2ban
fi

# ==========================================================================
# 3. sshd ハードニング: X11Forwarding / PermitRootLogin を明示的に無効化
# ==========================================================================
SSHD_HARDENING=/etc/ssh/sshd_config.d/99-hardening.conf
if [ ! -f "$SSHD_HARDENING" ]; then
  log "Writing $SSHD_HARDENING"
  sudo tee "$SSHD_HARDENING" > /dev/null <<'SSHD'
X11Forwarding no
PermitRootLogin no
SSHD
  if sudo sshd -t; then
    sudo systemctl reload sshd
  else
    log "ERROR: sshd config invalid, reverting"
    sudo rm -f "$SSHD_HARDENING"
    exit 1
  fi
fi

# ==========================================================================
# 4. unattended-upgrades (自動セキュリティパッチ): 既にインストール済み/有効想定
#    状態のみ確認
# ==========================================================================
if systemctl is-active --quiet unattended-upgrades; then
  log "unattended-upgrades active"
else
  log "WARN: unattended-upgrades not active — investigate"
fi

# ==========================================================================
# 5. iptables (既存): 80/443/5678 ACCEPT は n8n 運用で必要、既存設定を維持
#    具体的な iptables 設定はこのサーバーに既に適用済み (initial setup 時)
# ==========================================================================

log "setup.sh complete"
