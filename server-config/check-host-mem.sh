#!/usr/bin/env bash
# OCI n8n-server の memory / swap 監視 (#567 Phase 4)
#
# 10 分間隔で systemd timer から実行され、container memory.current と host swap を
# 取得して閾値判定、level 変化時のみ obs-notify webhook に POST する。
#
# 設計方針 (2026-06-06 改修 / #567):
# - severity 判定は container memory.current (ライブ値) で行う。
#   memory.peak は累計値 (container 起動以降のピーク、restart で reset) のため
#   起動直後の boot/migration スパイクで誤発火する。peak は summary の参考表示のみ。
# - 持続判定: 連続 SUSTAIN_SAMPLES サンプル (10分 × 2 = 約20分) 非 ok で初めて
#   発火する。単発スパイク・boot 直後の一過性負荷を拾わない。
# - severity 上限は warning。memory/swap pressure は「朝確認すべき」レベルであり、
#   実際の停止 (OOM kill → container down) は HC.io / n8n-watchdog / uptime-kuma が
#   別途捕捉する。pressure 段階で「夜中に起こす critical」は撃たない。
# - state file (level + started_at + streak) を /var/lib/oci-mem-watch/state.json に
#   永続化。level 不変なら送信しない (連発抑制)。restart_detected で state リセット。
#
# 既存 ~/.claude/scripts/oci-host-stats.py の bash 移植版。
# Python 版は Windows ローカル + briefing.py 用に残置。

set -euo pipefail

CONTAINER="n8n-docker-n8n-1"
STATE_DIR="/var/lib/oci-mem-watch"
STATE_FILE="${STATE_DIR}/state.json"
WEBHOOK_URL="http://localhost:5678/webhook/obs-notify"

# 閾値 (warning のみ。critical は撤廃 — 停止系は別監視が捕捉する)
CURRENT_WARN=85   # container memory.current / memory.max のライブ使用率 (%)
SWAP_WARN=80      # host swap 使用率 (%)
# 連続何サンプル非 ok で発火するか (10分間隔 × 2 = 約20分の持続を要求)
SUSTAIN_SAMPLES=2

log() { echo "[oci-mem-watch] $*" >&2; }

mkdir -p "$STATE_DIR"  # setup.sh で作成済みだが手動実行時のフォールバック

# ---- container 値取得 (memory.current / memory.peak / memory.max を 1 回の docker exec で) ----
if ! docker_out=$(docker exec "$CONTAINER" sh -c 'cat /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.max' 2>/dev/null); then
  log "docker exec failed (container down?), exiting"
  exit 0
fi
mapfile -t lines <<< "$docker_out"
current_bytes="${lines[0]:-}"
peak_bytes="${lines[1]:-}"
limit_bytes="${lines[2]:-}"
started_at=$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER" 2>/dev/null || echo "")

if [ -z "$current_bytes" ] || [ -z "$limit_bytes" ] || [ "$limit_bytes" = "0" ] || [ "$limit_bytes" = "max" ]; then
  log "invalid current/limit (current=$current_bytes limit=$limit_bytes), exiting"
  exit 0
fi

current_pct=$(awk "BEGIN { printf \"%.1f\", $current_bytes / $limit_bytes * 100 }")
# peak は参考表示のみ (severity 判定には使わない)
peak_pct="n/a"
if [ -n "$peak_bytes" ] && [ "$peak_bytes" != "max" ]; then
  peak_pct=$(awk "BEGIN { printf \"%.1f\", $peak_bytes / $limit_bytes * 100 }")
fi

# ---- host swap (1 回の awk で計算まで完結) ----
swap_used_pct=$(awk '/^SwapTotal:/{t=$2} /^SwapFree:/{f=$2} END{
  if(t>0) printf "%.1f", (t-f)/t*100; else print "0"
}' /proc/meminfo)

# ---- 閾値判定 (warning のみ。ok|warning を返す) ----
judge() {
  # $1=value, $2=warn -> echo "ok|warning"
  awk -v v="$1" -v w="$2" 'BEGIN { if (v + 0 >= w + 0) print "warning"; else print "ok"; }'
}

mem_level=$(judge "$current_pct" "$CURRENT_WARN")
swap_level=$(judge "$swap_used_pct" "$SWAP_WARN")

# このサンプル単体の raw level (max)
raw_level="ok"
[ "$mem_level" = "warning" ] && raw_level="warning"
[ "$swap_level" = "warning" ] && raw_level="warning"

# ---- state 読み込み (level=最後に通知した level / started_at / streak) ----
prev_level="ok"
prev_started=""
prev_streak=0
if [ -f "$STATE_FILE" ]; then
  if read -r prev_level prev_started prev_streak < <(
    jq -r '[.level // "ok", .started_at // "-", .streak // 0] | @tsv' "$STATE_FILE" 2>/dev/null
  ); then
    [ "$prev_started" = "-" ] && prev_started=""
  fi
fi
# 数値でなければ 0 に補正
case "$prev_streak" in (''|*[!0-9]*) prev_streak=0 ;; esac

# ---- restart 検知: started_at が変われば state をリセット ----
restart_detected="false"
if [ -n "$prev_started" ] && [ -n "$started_at" ] && [ "$prev_started" != "$started_at" ]; then
  restart_detected="true"
  prev_level="ok"
  prev_streak=0
fi

# ---- streak 更新 + 持続判定 ----
if [ "$raw_level" = "warning" ]; then
  streak=$((prev_streak + 1))
else
  streak=0
fi

# 連続 SUSTAIN_SAMPLES 以上で初めて warning を有効化 (単発スパイクを無視)
effective_level="ok"
if [ "$streak" -ge "$SUSTAIN_SAMPLES" ]; then
  effective_level="warning"
fi

# ---- state file 更新 (送信成否に関わらず保存) ----
jq -n \
  --arg level "$effective_level" \
  --arg started_at "$started_at" \
  --argjson streak "$streak" \
  '{level: $level, started_at: $started_at, streak: $streak}' \
  > "$STATE_FILE"

# ---- level 変化なしなら終了 ----
if [ "$effective_level" = "$prev_level" ]; then
  log "no level change ($effective_level), current=${current_pct}% swap=${swap_used_pct}% streak=${streak}"
  exit 0
fi

# ---- obs-notify payload 組立 ----
if [ "$effective_level" = "ok" ]; then
  severity="info"
  subject="OCI n8n-server memory pressure 復旧 (${prev_level} → ok)"
else
  severity="$effective_level"
  subject="OCI n8n-server memory pressure ${effective_level} (current ${current_pct}% / swap ${swap_used_pct}%)"
fi

summary_lines=(
  "container.memory_current: ${current_pct}% (ライブ)"
  "host.swap_used: ${swap_used_pct}%"
  "container.memory_peak: ${peak_pct}% (参考: 起動以降の累計ピーク、判定には不使用)"
  "container.started_at: ${started_at}"
  "sustained: ${streak} / ${SUSTAIN_SAMPLES} サンプル (10分間隔)"
)
if [ "$restart_detected" = "true" ]; then
  summary_lines+=("(container restart detected, state reset to ok)")
fi
summary_lines+=("--- thresholds ---")
summary_lines+=("current warn=${CURRENT_WARN}% / swap warn=${SWAP_WARN}% (critical なし)")
summary=$(printf '%s\n' "${summary_lines[@]}")

payload=$(jq -n \
  --arg severity "$severity" \
  --arg subject "$subject" \
  --arg summary "$summary" \
  '{severity: $severity, service: "netdata", subject: $subject, summary: $summary, repo: "n8n-server"}')

log "level transition ${prev_level} → ${effective_level}, posting to obs-notify"

# ---- POST (failure non-fatal: timer 自体は止めない) ----
if ! curl -sS --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "$WEBHOOK_URL" >/dev/null; then
  log "obs-notify POST failed (non-fatal)"
  exit 0
fi

log "obs-notify POST ok"
