#!/usr/bin/env bash
# OCI n8n-server の memory / swap 監視 (#567 Phase 4)
#
# 10 分間隔で systemd timer から実行され、container memory.peak と host swap を
# 取得して閾値判定、level 変化時のみ obs-notify webhook に POST する。
#
# - container memory.peak は累計値で container restart で reset される
# - state file (level + started_at) を /var/lib/oci-mem-watch/state.json に永続化
# - restart_detected (started_at 比較) で prev_level=ok にリセット
# - level 不変なら送信しない (連発抑制)
#
# 既存 ~/.claude/scripts/oci-host-stats.py の bash 移植版。
# Python 版は Windows ローカル + briefing.py 用に残置。

set -euo pipefail

CONTAINER="n8n-docker-n8n-1"
STATE_DIR="/var/lib/oci-mem-watch"
STATE_FILE="${STATE_DIR}/state.json"
WEBHOOK_URL="http://localhost:5678/webhook/obs-notify"

# 閾値 (oci-host-stats.py THRESHOLDS と同値)
PEAK_WARN=80
PEAK_CRIT=90
SWAP_WARN=80
SWAP_CRIT=90

log() { echo "[oci-mem-watch] $*" >&2; }

mkdir -p "$STATE_DIR"  # setup.sh で作成済みだが手動実行時のフォールバック

# ---- container 値取得 (memory.peak / memory.max を 1 回の docker exec で取得) ----
if ! docker_out=$(docker exec "$CONTAINER" sh -c 'cat /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.max' 2>/dev/null); then
  log "docker exec failed (container down?), exiting"
  exit 0
fi
mapfile -t lines <<< "$docker_out"
peak_bytes="${lines[0]:-}"
limit_bytes="${lines[1]:-}"
started_at=$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER" 2>/dev/null || echo "")

if [ -z "$peak_bytes" ] || [ -z "$limit_bytes" ] || [ "$limit_bytes" = "0" ] || [ "$limit_bytes" = "max" ]; then
  log "invalid peak/limit (peak=$peak_bytes limit=$limit_bytes), exiting"
  exit 0
fi

peak_pct=$(awk "BEGIN { printf \"%.1f\", $peak_bytes / $limit_bytes * 100 }")

# ---- host swap (1 回の awk で計算まで完結) ----
swap_used_pct=$(awk '/^SwapTotal:/{t=$2} /^SwapFree:/{f=$2} END{
  if(t>0) printf "%.1f", (t-f)/t*100; else print "0"
}' /proc/meminfo)

# ---- 閾値判定 ----
judge() {
  # $1=value, $2=warn, $3=crit -> echo "ok|warning|critical"
  awk -v v="$1" -v w="$2" -v c="$3" 'BEGIN {
    if (v + 0 >= c + 0) print "critical";
    else if (v + 0 >= w + 0) print "warning";
    else print "ok";
  }'
}

peak_level=$(judge "$peak_pct" "$PEAK_WARN" "$PEAK_CRIT")
swap_level=$(judge "$swap_used_pct" "$SWAP_WARN" "$SWAP_CRIT")

# 全体 level (max)
cur_level="ok"
for lv in "$peak_level" "$swap_level"; do
  case "$lv" in
    critical) cur_level="critical" ;;
    warning) [ "$cur_level" != "critical" ] && cur_level="warning" ;;
  esac
done

# ---- state diff (連発抑制 + restart 検知) ----
prev_level="ok"
prev_started=""
if [ -f "$STATE_FILE" ]; then
  # 1 回の jq で level + started_at を tab 区切りで取得 ("-" sentinel で空文字を区別)
  if read -r prev_level prev_started < <(
    jq -r '[.level // "ok", .started_at // "-"] | @tsv' "$STATE_FILE" 2>/dev/null
  ); then
    [ "$prev_started" = "-" ] && prev_started=""
  fi
fi

restart_detected="false"
if [ -n "$prev_started" ] && [ -n "$started_at" ] && [ "$prev_started" != "$started_at" ]; then
  restart_detected="true"
  prev_level="ok"
fi

# state file 更新 (送信成否に関わらず保存)
jq -n \
  --arg level "$cur_level" \
  --arg started_at "$started_at" \
  '{level: $level, started_at: $started_at}' \
  > "$STATE_FILE"

# ---- level 変化なしなら終了 ----
if [ "$cur_level" = "$prev_level" ]; then
  log "no level change ($cur_level), peak=${peak_pct}% swap=${swap_used_pct}%"
  exit 0
fi

# ---- obs-notify payload 組立 ----
if [ "$cur_level" = "ok" ]; then
  severity="info"
  subject="OCI n8n-server memory pressure 復旧 (${prev_level} → ok)"
else
  severity="$cur_level"
  subject="OCI n8n-server memory pressure ${cur_level} (peak ${peak_pct}% / swap ${swap_used_pct}%)"
fi

summary_lines=(
  "container.memory_peak: ${peak_pct}% (累計)"
  "host.swap_used: ${swap_used_pct}%"
  "container.started_at: ${started_at}"
)
if [ "$restart_detected" = "true" ]; then
  summary_lines+=("(container restart detected, prev_level reset to ok)")
fi
summary_lines+=("--- thresholds ---")
summary_lines+=("peak warn=${PEAK_WARN}% crit=${PEAK_CRIT}% / swap warn=${SWAP_WARN}% crit=${SWAP_CRIT}%")
summary=$(printf '%s\n' "${summary_lines[@]}")

payload=$(jq -n \
  --arg severity "$severity" \
  --arg subject "$subject" \
  --arg summary "$summary" \
  '{severity: $severity, service: "netdata", subject: $subject, summary: $summary, repo: "n8n-server"}')

log "level transition ${prev_level} → ${cur_level}, posting to obs-notify"

# ---- POST (failure non-fatal: timer 自体は止めない) ----
if ! curl -sS --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "$WEBHOOK_URL" >/dev/null; then
  log "obs-notify POST failed (non-fatal)"
  exit 0
fi

log "obs-notify POST ok"
