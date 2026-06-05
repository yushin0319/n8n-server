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
# 7b. uv (Python package manager) ユーザーローカルインストール
#     scripts/kuma_bootstrap_monitors.py 等の Python スクリプト実行用。
#     ~/.local/bin に配置（apt 不要、OS layer 非変更）。
# ==========================================================================
if [ ! -x "$HOME/.local/bin/uv" ]; then
  log "Installing uv (~/.local/bin)"
  curl -LsSf https://astral.sh/uv/install.sh | sh
else
  log "uv already installed: $($HOME/.local/bin/uv --version)"
fi

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
#
#    --project-directory はリポルート (~/n8n-server) を明示。compose は -f 指定時
#    に compose ファイルの親 (server-config/) を project directory とみなし、
#    そこから .env を読むため、ルートの .env が拾われない問題を回避する。
#    対象 env: N8N_SENTRY_DSN / LOKI_USER / LOKI_PASSWORD など `${VAR}` 補間。
# ==========================================================================
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
if [ -f "$COMPOSE_FILE" ]; then
  log "docker compose up -d --pull always (project: $PROJECT_ROOT, file: $COMPOSE_FILE)"
  # set -e で失敗時に即 exit するが、ログで明示的に失敗を示すため明示チェック。
  if ! sudo docker compose --project-directory "$PROJECT_ROOT" -f "$COMPOSE_FILE" up -d --pull always; then
    log "ERROR: docker compose up failed"
    exit 1
  fi
fi

# ==========================================================================
# 10. Netdata Agent (観測性強化 L13)
#     host CPU/mem/disk/network/process と Docker cgroups (n8n / kuma) を
#     agent 側 2秒粒度で収集し Netdata Cloud に送信。1GB RAM Micro かつ既に
#     n8n が swap に食い込んでいる構成なので、ml/python.d/charts.d を無効化、
#     db を ram モード + retention 3600 (= 直近1時間のみメモリ保持) に絞る。
#
#     初回 install 時のみ NETDATA_CLAIM_TOKEN/ROOMS が必要。既にインストール
#     済みなら token 不要 (no-op)。CI 等で誤実行を避けるため、未インストール
#     かつ token 未設定の場合は install 自体をスキップ。
# ==========================================================================
NETDATA_SRC="$SCRIPT_DIR/netdata.conf"
NETDATA_DST=/etc/netdata/netdata.conf

if ! command -v netdata >/dev/null 2>&1; then
  if [ -n "${NETDATA_CLAIM_TOKEN:-}" ] && [ -n "${NETDATA_CLAIM_ROOMS:-}" ]; then
    log "Installing Netdata + claiming to Cloud"
    curl -fsSL https://get.netdata.cloud/kickstart.sh -o /tmp/netdata-kickstart.sh
    sudo sh /tmp/netdata-kickstart.sh \
      --non-interactive \
      --stable-channel \
      --disable-telemetry \
      --claim-token "$NETDATA_CLAIM_TOKEN" \
      --claim-rooms "$NETDATA_CLAIM_ROOMS" \
      --claim-url https://app.netdata.cloud
    rm -f /tmp/netdata-kickstart.sh
  else
    log "Netdata not installed and NETDATA_CLAIM_TOKEN/ROOMS not set — skipping install"
  fi
else
  log "Netdata already installed: $(netdata -v 2>/dev/null | head -1)"
fi

# 低メモリ用 conf の同期 (Netdata 導入済みのときのみ)
if command -v netdata >/dev/null 2>&1 && [ -f "$NETDATA_SRC" ]; then
  if ! sudo diff -q "$NETDATA_SRC" "$NETDATA_DST" >/dev/null 2>&1; then
    log "Syncing netdata.conf → $NETDATA_DST"
    sudo cp "$NETDATA_SRC" "$NETDATA_DST"
    sudo chown root:netdata "$NETDATA_DST"
    sudo chmod 0644 "$NETDATA_DST"
    sudo systemctl restart netdata
  else
    log "netdata.conf already in sync"
  fi
fi

# health_alarm_notify.conf の同期 (#586): agent custom_sender → obs-from-netdata
# 重要 alarm (memory/swap/OOM/disk/reboot 系) のみ allowlist で adapter WF に POST。
# netdata は user override (/etc/netdata/) を template (/usr/lib/netdata/conf.d/) の
# 後に source するため、差分のみで上書き可能 (テンプレ全体コピー不要)。
HEALTH_NOTIFY_SRC="$SCRIPT_DIR/health_alarm_notify.conf"
HEALTH_NOTIFY_DST=/etc/netdata/health_alarm_notify.conf

if command -v netdata >/dev/null 2>&1 && [ -f "$HEALTH_NOTIFY_SRC" ]; then
  if ! sudo diff -q "$HEALTH_NOTIFY_SRC" "$HEALTH_NOTIFY_DST" >/dev/null 2>&1; then
    log "Syncing health_alarm_notify.conf → $HEALTH_NOTIFY_DST"
    sudo cp "$HEALTH_NOTIFY_SRC" "$HEALTH_NOTIFY_DST"
    sudo chown root:netdata "$HEALTH_NOTIFY_DST"
    sudo chmod 0640 "$HEALTH_NOTIFY_DST"
    # health 設定のみの変更は reload-health で反映可能 (restart 不要)。
    # 失敗時はログに残す (sync 自体は成功しているので setup.sh 全体は止めない)。
    if ! sudo netdatacli reload-health >/dev/null 2>&1; then
      log "WARNING: netdatacli reload-health failed — check 'systemctl status netdata'"
    fi
  else
    log "health_alarm_notify.conf already in sync"
  fi
fi

# ==========================================================================
# 11. OCI host memory watch (#567 Phase 4): systemd timer で 10 分間隔に
#     check-host-mem.sh を実行し、container.memory.current (ライブ値) / host swap が
#     閾値を連続 2 サンプル (約20分) 超え、かつ level 変化があれば obs-notify に POST。
#     peak (累計値) は boot スパイク誤発火するため判定に使わない (#567 改修 2026-06-06)。
#     n8n container 内から host cgroup を読めないため、host 側の systemd で実装。
#     負荷見積: 1 回 100-300ms / transient ~10-20MB。既存 cron より軽い。
# ==========================================================================
OCI_MEM_SH_SRC="$SCRIPT_DIR/check-host-mem.sh"
OCI_MEM_SH_DST=/usr/local/bin/check-host-mem.sh
OCI_MEM_SVC_SRC="$SCRIPT_DIR/oci-mem-watch.service"
OCI_MEM_SVC_DST=/etc/systemd/system/oci-mem-watch.service
OCI_MEM_TMR_SRC="$SCRIPT_DIR/oci-mem-watch.timer"
OCI_MEM_TMR_DST=/etc/systemd/system/oci-mem-watch.timer

if [ -f "$OCI_MEM_SH_SRC" ] && [ -f "$OCI_MEM_SVC_SRC" ] && [ -f "$OCI_MEM_TMR_SRC" ]; then
  # check-host-mem.sh は jq に依存。未インストールなら apt install jq
  if ! command -v jq >/dev/null 2>&1; then
    log "Installing jq (required by check-host-mem.sh)"
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -qqy jq
  fi

  # state ディレクトリを ubuntu 所有で確保 (Type=oneshot User=ubuntu が書ける)
  if [ ! -d /var/lib/oci-mem-watch ]; then
    log "Creating /var/lib/oci-mem-watch (owner ubuntu)"
    sudo install -d -o ubuntu -g ubuntu -m 755 /var/lib/oci-mem-watch
  fi

  # スクリプト本体は実行ビット必須
  if ! sudo diff -q "$OCI_MEM_SH_SRC" "$OCI_MEM_SH_DST" >/dev/null 2>&1; then
    log "Installing $OCI_MEM_SH_DST"
    sudo install -m 755 "$OCI_MEM_SH_SRC" "$OCI_MEM_SH_DST"
  else
    log "$OCI_MEM_SH_DST already in sync"
  fi

  # service / timer は差分があれば cp + daemon-reload
  RELOAD_SYSTEMD=0
  for pair in "$OCI_MEM_SVC_SRC:$OCI_MEM_SVC_DST" "$OCI_MEM_TMR_SRC:$OCI_MEM_TMR_DST"; do
    SRC="${pair%%:*}"
    DST="${pair##*:}"
    if ! sudo diff -q "$SRC" "$DST" >/dev/null 2>&1; then
      log "Installing $DST"
      sudo cp "$SRC" "$DST"
      RELOAD_SYSTEMD=1
    fi
  done

  if [ "$RELOAD_SYSTEMD" = "1" ]; then
    log "systemctl daemon-reload"
    sudo systemctl daemon-reload
  fi

  if ! systemctl is-enabled --quiet oci-mem-watch.timer 2>/dev/null; then
    log "Enabling oci-mem-watch.timer"
    sudo systemctl enable --now oci-mem-watch.timer
  elif ! systemctl is-active --quiet oci-mem-watch.timer; then
    log "Starting oci-mem-watch.timer (was inactive)"
    sudo systemctl start oci-mem-watch.timer
  fi
fi

# ==========================================================================
# 12. n8n healthz watchdog (2026-05-19 障害対策): systemd timer で 5 分間隔に
#     check-n8n-health.sh を実行し、localhost:5678/healthz が連続 4 回失敗
#     (= 約20分の継続ダウン) したら docker restart で復旧、復旧後に obs-notify へ
#     POST する。コンテナは Up のままイベントループ閉塞する「ゾンビ化」は docker の
#     restart: unless-stopped では復旧しないため、healthz ベースの監視で補う。
#     起動時 VACUUM 窓を誤検知しないよう grace 20分を state file
#     (/var/lib/n8n-watchdog/state.json) で管理する。
# ==========================================================================
N8N_WD_SH_SRC="$SCRIPT_DIR/check-n8n-health.sh"
N8N_WD_SH_DST=/usr/local/bin/check-n8n-health.sh
N8N_WD_SVC_SRC="$SCRIPT_DIR/n8n-watchdog.service"
N8N_WD_SVC_DST=/etc/systemd/system/n8n-watchdog.service
N8N_WD_TMR_SRC="$SCRIPT_DIR/n8n-watchdog.timer"
N8N_WD_TMR_DST=/etc/systemd/system/n8n-watchdog.timer

if [ -f "$N8N_WD_SH_SRC" ] && [ -f "$N8N_WD_SVC_SRC" ] && [ -f "$N8N_WD_TMR_SRC" ]; then
  # check-n8n-health.sh は jq に依存。セクション 11 で導入済みのはずだが、
  # 11 がスキップされた環境向けの二重保険として未インストールなら入れる。
  if ! command -v jq >/dev/null 2>&1; then
    log "Installing jq (required by check-n8n-health.sh)"
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -qqy jq
  fi

  # state ディレクトリを ubuntu 所有で確保 (Type=oneshot User=ubuntu が書ける)
  if [ ! -d /var/lib/n8n-watchdog ]; then
    log "Creating /var/lib/n8n-watchdog (owner ubuntu)"
    sudo install -d -o ubuntu -g ubuntu -m 755 /var/lib/n8n-watchdog
  fi

  # スクリプト本体は実行ビット必須
  if ! sudo diff -q "$N8N_WD_SH_SRC" "$N8N_WD_SH_DST" >/dev/null 2>&1; then
    log "Installing $N8N_WD_SH_DST"
    sudo install -m 755 "$N8N_WD_SH_SRC" "$N8N_WD_SH_DST"
  else
    log "$N8N_WD_SH_DST already in sync"
  fi

  # service / timer は差分があれば cp + daemon-reload
  RELOAD_SYSTEMD=0
  for pair in "$N8N_WD_SVC_SRC:$N8N_WD_SVC_DST" "$N8N_WD_TMR_SRC:$N8N_WD_TMR_DST"; do
    SRC="${pair%%:*}"
    DST="${pair##*:}"
    if ! sudo diff -q "$SRC" "$DST" >/dev/null 2>&1; then
      log "Installing $DST"
      sudo cp "$SRC" "$DST"
      RELOAD_SYSTEMD=1
    fi
  done

  if [ "$RELOAD_SYSTEMD" = "1" ]; then
    log "systemctl daemon-reload"
    sudo systemctl daemon-reload
  fi

  if ! systemctl is-enabled --quiet n8n-watchdog.timer 2>/dev/null; then
    log "Enabling n8n-watchdog.timer"
    sudo systemctl enable --now n8n-watchdog.timer
  elif ! systemctl is-active --quiet n8n-watchdog.timer; then
    log "Starting n8n-watchdog.timer (was inactive)"
    sudo systemctl start n8n-watchdog.timer
  fi
fi

# ==========================================================================
# 13. n8n SQLite WAL checkpoint: systemd timer で日次 03:00 JST に
#     PRAGMA wal_checkpoint(TRUNCATE) を実行し WAL ファイルを 0 bytes に reset する。
#     n8n は起動時のみ DB_SQLITE_VACUUM_ON_STARTUP=true で checkpoint+VACUUM するが、
#     運用中の WAL は autocheckpoint で末尾まで commit されるだけで file 自体は
#     truncate されない (SQLite 仕様)。2026-05-19 ゾンビ障害時 WAL 77MB、2026-06-05
#     起動 25h で WAL 63MB を再確認。container memory_limit 512MB を圧迫し
#     EventLoopBlocked / cron skip の素地になるため日次で reset する。busy 時は
#     非エラー扱いで次回 timer 再試行 (n8n の書き込みと干渉しない)。
# ==========================================================================
WAL_CK_SH_SRC="$SCRIPT_DIR/checkpoint-n8n-wal.sh"
WAL_CK_SH_DST=/usr/local/bin/checkpoint-n8n-wal.sh
WAL_CK_SVC_SRC="$SCRIPT_DIR/n8n-wal-checkpoint.service"
WAL_CK_SVC_DST=/etc/systemd/system/n8n-wal-checkpoint.service
WAL_CK_TMR_SRC="$SCRIPT_DIR/n8n-wal-checkpoint.timer"
WAL_CK_TMR_DST=/etc/systemd/system/n8n-wal-checkpoint.timer

if [ -f "$WAL_CK_SH_SRC" ] && [ -f "$WAL_CK_SVC_SRC" ] && [ -f "$WAL_CK_TMR_SRC" ]; then
  # sqlite3 が無ければ install (Ubuntu には base にあるはずだが念のため)
  if ! command -v sqlite3 >/dev/null 2>&1; then
    log "Installing sqlite3 (required by checkpoint-n8n-wal.sh)"
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -qqy sqlite3
  fi

  if ! sudo diff -q "$WAL_CK_SH_SRC" "$WAL_CK_SH_DST" >/dev/null 2>&1; then
    log "Installing $WAL_CK_SH_DST"
    sudo install -m 755 "$WAL_CK_SH_SRC" "$WAL_CK_SH_DST"
  else
    log "$WAL_CK_SH_DST already in sync"
  fi

  RELOAD_SYSTEMD=0
  for pair in "$WAL_CK_SVC_SRC:$WAL_CK_SVC_DST" "$WAL_CK_TMR_SRC:$WAL_CK_TMR_DST"; do
    SRC="${pair%%:*}"
    DST="${pair##*:}"
    if ! sudo diff -q "$SRC" "$DST" >/dev/null 2>&1; then
      log "Installing $DST"
      sudo cp "$SRC" "$DST"
      RELOAD_SYSTEMD=1
    fi
  done

  if [ "$RELOAD_SYSTEMD" = "1" ]; then
    log "systemctl daemon-reload"
    sudo systemctl daemon-reload
  fi

  if ! systemctl is-enabled --quiet n8n-wal-checkpoint.timer 2>/dev/null; then
    log "Enabling n8n-wal-checkpoint.timer"
    sudo systemctl enable --now n8n-wal-checkpoint.timer
  elif ! systemctl is-active --quiet n8n-wal-checkpoint.timer; then
    log "Starting n8n-wal-checkpoint.timer (was inactive)"
    sudo systemctl start n8n-wal-checkpoint.timer
  fi
fi

log "setup.sh complete"
