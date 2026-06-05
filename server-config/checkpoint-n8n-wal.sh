#!/usr/bin/env bash
# n8n SQLite WAL checkpoint (TRUNCATE) — 日次で WAL ファイルを reset し肥大化を防ぐ
#
# 背景: 2026-05-19 ゾンビ障害時に WAL 77MB を確認、2026-06-05 にも起動 25h で 63MB を
#       再確認。n8n は DB_SQLITE_VACUUM_ON_STARTUP=true で起動時に checkpoint+VACUUM
#       するが、運用中は PRAGMA wal_autocheckpoint (デフォルト 1000 pages ≒ 4MB) で
#       ファイル末尾まで checkpoint するだけで、WAL ファイル自体は truncate されない
#       (SQLite の仕様)。container memory_limit 512MB に対して page cache を圧迫し
#       EventLoopBlocked / cron skip の素地になる。
#
# 動作: ホスト側 sqlite3 から n8n_data volume の database.sqlite に対し
#       PRAGMA wal_checkpoint(TRUNCATE) を発行して WAL ファイルを 0 bytes にする。
#       n8n の書き込み中は busy 返却されるため busy_timeout=5000ms を設定。
#       busy 失敗時はログのみで終了 (次回 timer で再試行) — 障害扱いしない。

set -euo pipefail

DB_PATH="/var/lib/docker/volumes/n8n-docker_n8n_data/_data/database.sqlite"
WAL_PATH="${DB_PATH}-wal"

log() { echo "[n8n-wal-checkpoint] $*" >&2; }

if [ ! -f "$DB_PATH" ]; then
  log "DB not found at $DB_PATH — skipping"
  exit 0
fi

size_before=$(stat -c %s "$WAL_PATH" 2>/dev/null || echo 0)

# checkpoint TRUNCATE 実行。出力は "busy|log_pages|checkpointed_pages" 形式 (busy=0 で成功)。
# busy=1 のとき sqlite3 自身は exit 0 を返すため、出力を見て成否判定する。
result_rc=0
result=$(sqlite3 \
  -cmd "PRAGMA busy_timeout=5000;" \
  "$DB_PATH" \
  "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1) || result_rc=$?

size_after=$(stat -c %s "$WAL_PATH" 2>/dev/null || echo 0)

if [ "$result_rc" -ne 0 ]; then
  log "WARN: sqlite3 exited rc=$result_rc output='$result' — will retry next cycle"
  exit 0
fi

case "$result" in
  0\|*)
    log "checkpoint ok: result=$result wal_before=${size_before}B wal_after=${size_after}B"
    ;;
  1\|*)
    log "WARN: checkpoint busy (n8n writing) result=$result wal=${size_after}B — will retry next cycle"
    ;;
  *)
    log "checkpoint returned unexpected output: '$result' wal=${size_after}B"
    ;;
esac

exit 0
