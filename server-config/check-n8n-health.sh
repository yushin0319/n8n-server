#!/usr/bin/env bash
# n8n healthz watchdog — ゾンビ化（コンテナ Up だが HTTP 無応答）の自動検知・復旧
#
# 背景: 2026-05-19、n8n がイベントループ完全閉塞で約34.7時間ダウンした。コンテナは
#       `Up` のままなので docker の restart: unless-stopped では復旧しない。かつて
#       ゾンビ化をマスクしていた毎日 04:00 JST の docker restart timer が消失して
#       おり、自動復旧の網が無かったことが長時間ダウンの決定的要因。
#
# 動作: systemd timer から 5 分間隔で実行され、localhost:5678/healthz を叩く。
#       healthz が連続 FAIL_THRESHOLD 回失敗したら `docker restart` で復旧する。
#       既存 check-host-mem.sh（oci-mem-watch）と同じ IaC パターン。
#
# 復旧の時間感覚:
#   - 新規ゾンビ化の検知 → restart: 連続失敗 4 回 ≒ 20 分。
#   - restart 後は grace 20 分（起動時 VACUUM 窓）→ 再評価。回復しなければ次の
#     restart まで約 40 分。これを MAX_RESTARTS 回繰り返しても回復しない場合は
#     「restart では直らない hard-down」と判断し、自動 restart を止めて CRITICAL
#     ログでエスカレーションする（無限 restart で障害を覆い隠さないため）。
#
# 誤検知（restart ループ）回避:
#   - grace: コンテナ起動直後は起動時 VACUUM（DB_SQLITE_VACUUM_ON_STARTUP）が
#     healthz を数分ブロックする（実績 ~3分、過去 280MB DB で ~11分、再肥大で延伸も）。
#     コンテナ起動（started_at）または watchdog の restart 発行（last_restart_at）から
#     GRACE_SECS 未満は healthz 失敗を無視する。両方を見るのは restart が途中で
#     kill され started_at が更新されないケースの保険。
#   - Running 判定: 停止／終了したコンテナはゾンビではない（人手や docker の
#     restart: unless-stopped の領分）。Running=true のときだけ restart 対象にする。
#
# obs-notify の循環依存回避:
#   通知先 webhook は n8n 自身（localhost:5678/webhook/obs-notify）。ゾンビ化中の
#   n8n に通知しても届かないため、restart 時点では通知せず state を "restarted" にし、
#   healthz 回復を確認できたサイクルで「再起動した→復旧した」を 1 回通知する。

set -euo pipefail

CONTAINER="n8n-docker-n8n-1"
HEALTHZ_URL="http://localhost:5678/healthz"
WEBHOOK_URL="http://localhost:5678/webhook/obs-notify"
STATE_DIR="/var/lib/n8n-watchdog"
STATE_FILE="${STATE_DIR}/state.json"

# 判定パラメータ（timer 間隔 5 分前提）
FAIL_THRESHOLD=4      # healthz 連続失敗この回数で restart（5分×4 ≒ 20分の継続ダウン）
GRACE_SECS=1200       # 20分: コンテナ(再)起動直後の猶予。起動時 VACUUM 窓を誤検知しない
MAX_RESTARTS=3        # この回数 restart しても回復しなければ自動 restart を止めエスカレーション
HEALTHZ_TIMEOUT=10    # healthz curl の最大待ち秒（ゾンビ時はここでタイムアウトする）

# last_status の取りうる値（生文字列のタイポによる状態機械破壊を防ぐ）
readonly ST_OK="ok"               # 正常
readonly ST_FAILING="failing"     # healthz 失敗中（閾値未満／restart 断念中）
readonly ST_RESTARTED="restarted" # watchdog が restart 実行済み・healthz 回復待ち

log() { echo "[n8n-watchdog] $*" >&2; }

mkdir -p "$STATE_DIR" 2>/dev/null || true  # setup.sh で作成済み。手動実行時のフォールバック
now=$(date +%s)

# ---- state 読込（jq で型強制。破損・空文字混入でも @tsv のフィールドずれを防ぐ）----
fail_count=0
last_restart_at=0
restart_count=0
last_status="$ST_OK"
if [ -f "$STATE_FILE" ]; then
  if IFS=$'\t' read -r fail_count last_restart_at restart_count last_status < <(
    jq -r '[
      (.fail_count      | if type == "number" then . else 0 end),
      (.last_restart_at | if type == "number" then . else 0 end),
      (.restart_count   | if type == "number" then . else 0 end),
      (.last_status     | if type == "string" then . else "ok" end)
    ] | @tsv' "$STATE_FILE" 2>/dev/null
  ); then
    :
  else
    log "state file unreadable, using defaults"
    fail_count=0; last_restart_at=0; restart_count=0; last_status="$ST_OK"
  fi
fi

# ---- state 保存（atomic: temp に書いて rename。書き込み中 kill での破損を防ぐ）----
# 失敗しても呼び出し側を止めない（set -e 対策で常に return 0、エラーは log のみ）。
save_state() {
  # $1=fail_count $2=last_restart_at $3=restart_count $4=last_status
  local tmp
  if ! tmp=$(mktemp "${STATE_DIR}/.state.XXXXXX" 2>/dev/null); then
    log "ERROR: mktemp failed in $STATE_DIR — state not saved"
    return 0
  fi
  if jq -n \
    --argjson fail_count "$1" \
    --argjson last_restart_at "$2" \
    --argjson restart_count "$3" \
    --arg last_status "$4" \
    '{fail_count: $fail_count, last_restart_at: $last_restart_at, restart_count: $restart_count, last_status: $last_status}' \
    > "$tmp" 2>/dev/null && mv -f "$tmp" "$STATE_FILE"; then
    :
  else
    log "ERROR: save_state failed (state dir not writable / owner mismatch?)"
    rm -f "$tmp"
  fi
  return 0
}

# ---- obs-notify POST（curl の終了コードを返す。POST 失敗は non-fatal）----
notify() {
  # $1=severity $2=subject $3=summary  → return 0=POST成功 / 非0=失敗
  local payload
  payload=$(jq -n \
    --arg severity "$1" \
    --arg subject "$2" \
    --arg summary "$3" \
    '{severity: $severity, service: "n8n", subject: $subject, summary: $summary, repo: "n8n-server"}')
  if curl -sS --max-time 10 -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$WEBHOOK_URL" >/dev/null 2>&1; then
    log "obs-notify POST ok ($1)"
    return 0
  fi
  log "obs-notify POST failed (non-fatal)"
  return 1
}

# ---- healthz 疎通確認（重い docker 系より先に。通常稼働時はここで完結）----
healthz_ok=false
if curl -sS --max-time "$HEALTHZ_TIMEOUT" --fail "$HEALTHZ_URL" >/dev/null 2>&1; then
  healthz_ok=true
fi

# ==========================================================================
# healthz 成功: カウンタをリセット。watchdog の restart 後の回復なら通知する。
# ==========================================================================
if [ "$healthz_ok" = true ]; then
  if [ "$last_status" = "$ST_RESTARTED" ]; then
    # watchdog の restart 後に n8n が復帰 → ここで初めて通知（復旧後の n8n 経由なので届く）。
    # ただし healthz 200 でも obs-notify WF が register 済みとは限らない（n8n は HTTP
    # bind 後に WF を非同期ロードする）。notify 失敗時は state を restarted のまま残し、
    # 次サイクルで再通知させる（この watchdog 唯一の通知を取りこぼさないため）。
    down_min=$(( (now - last_restart_at) / 60 ))
    summary=$(printf '%s\n' \
      "healthz 連続失敗を検知し docker restart を実行、n8n が復旧しました。" \
      "restart 時刻: $(date -d "@${last_restart_at}" '+%Y-%m-%d %H:%M:%S %Z')" \
      "復旧確認まで restart 後 約${down_min}分。" \
      "恒久対策は OCI A1-flex 移行 (Notion task #477)。")
    if notify "warning" "n8n watchdog: ゾンビ検知で自動再起動 → 復旧" "$summary"; then
      log "n8n recovered after watchdog restart (~${down_min}min); recovery notified"
      save_state 0 "$last_restart_at" 0 "$ST_OK"
    else
      log "n8n recovered but recovery notify failed; will retry next cycle"
      save_state 0 "$last_restart_at" 0 "$ST_RESTARTED"
    fi
  else
    if [ "$last_status" = "$ST_FAILING" ]; then
      log "n8n healthz recovered on its own (was failing, no restart needed)"
    else
      log "n8n healthz ok"
    fi
    save_state 0 "$last_restart_at" 0 "$ST_OK"
  fi
  exit 0
fi

# ==========================================================================
# healthz 失敗: コンテナ状態を確認し、ゾンビ判定 → 連続失敗で docker restart
# ==========================================================================
# Running 状態と起動時刻を 1 回の docker inspect で取得
if ! inspect=$(docker inspect -f '{{.State.Running}} {{.State.StartedAt}}' "$CONTAINER" 2>/dev/null); then
  log "container '$CONTAINER' not found — nothing to do"
  exit 0
fi
running="${inspect%% *}"      # 先頭トークン = true / false
started_iso="${inspect#* }"   # 残り = StartedAt (ISO 8601)

# Running でない（停止・終了）= ゾンビではない。docker の restart: unless-stopped か
# 人手の領分。watchdog が restart すると意図的な停止と衝突するので手を出さない。
if [ "$running" != "true" ]; then
  log "container not running (state=${running}) — not a zombie, leaving it alone"
  exit 0
fi

# 起動時刻のパース。失敗を 0 に握りつぶすと grace が無効化されるため cycle をスキップ。
if ! started_epoch=$(date -d "$started_iso" +%s 2>/dev/null) || [ "$started_epoch" -le 0 ]; then
  log "ERROR: cannot parse container StartedAt ('${started_iso}') — skipping cycle"
  exit 0
fi
uptime_secs=$(( now - started_epoch ))
since_restart=$(( now - last_restart_at ))

# grace: コンテナが最近 (再)起動した／watchdog が最近 restart を発行した直後は、
# 起動時 VACUUM で healthz が落ちるのが正常。GRACE_SECS 未満なら失敗を無視する。
if [ "$uptime_secs" -lt "$GRACE_SECS" ] || \
   { [ "$last_restart_at" -gt 0 ] && [ "$since_restart" -lt "$GRACE_SECS" ]; }; then
  log "healthz fail but within grace (uptime=${uptime_secs}s, since_restart=${since_restart}s < ${GRACE_SECS}s) — ignoring"
  exit 0
fi

# ここまで来たらゾンビ確定方向。連続失敗カウントを加算。
fail_count=$(( fail_count + 1 ))
log "healthz FAIL (consecutive fail_count=${fail_count}/${FAIL_THRESHOLD})"

if [ "$fail_count" -lt "$FAIL_THRESHOLD" ]; then
  save_state "$fail_count" "$last_restart_at" "$restart_count" "$ST_FAILING"
  exit 0
fi

# 閾値到達 = ゾンビ確定。restart を MAX_RESTARTS 回試しても回復しない場合は
# 「restart では直らない hard-down」とみなし、自動 restart を止めてエスカレーション。
if [ "$restart_count" -ge "$MAX_RESTARTS" ]; then
  log "CRITICAL: n8n still down after ${restart_count} watchdog restarts — giving up auto-restart, manual intervention required"
  # obs-notify は n8n 経由で届かないため journal の CRITICAL 行に委ねる（promtail→Loki）。
  # 並行して Healthchecks.io / Uptime Kuma が独立に DOWN を通知する。
  save_state "$fail_count" "$last_restart_at" "$restart_count" "$ST_FAILING"
  exit 0
fi

# docker restart 実行。途中 kill 耐性のため state を「restart 発行済み」に *先に* 記録する。
restart_count=$(( restart_count + 1 ))
log "fail_count reached threshold — RESTARTING '$CONTAINER' (attempt ${restart_count}/${MAX_RESTARTS})"
save_state 0 "$now" "$restart_count" "$ST_RESTARTED"

if docker restart "$CONTAINER" >/dev/null 2>&1; then
  log "docker restart issued OK (recovery notification deferred until healthz returns)"
else
  # restart 自体が失敗（docker daemon 異常等）。grace を効かせず次サイクルで即再試行
  # させるため last_restart_at を 0 に戻す（restart_count は加算済みのまま据え置く）。
  log "ERROR: docker restart FAILED for '$CONTAINER'"
  save_state "$FAIL_THRESHOLD" 0 "$restart_count" "$ST_FAILING"
fi
exit 0
