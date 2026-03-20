#!/bin/bash
# n8n Workflow Deploy Script
# GitHub Actions から呼び出され、変更されたワークフローを n8n API 経由でデプロイする
set -euo pipefail

N8N_API_URL="${N8N_API_URL:-https://yushin-n8n.duckdns.org/api/v1}"
N8N_API_KEY="${N8N_API_KEY:?N8N_API_KEY is required}"

SUCCESS=0
FAIL=0
SKIPPED=0

# PUT API 許可フィールドのフィルター
# settings 内の binaryMode, availableInMCP 等は 400 エラーになるため除外
BODY_FILTER='{name, nodes, connections, staticData, settings: (.settings | {executionOrder, callerPolicy, errorWorkflow} | with_entries(select(.value != null)))}'

retry_curl() {
  # DNS障害(6)・タイムアウト(28)対策: 最大3回リトライ（5秒間隔）
  local attempt
  for attempt in 1 2 3; do
    local result
    result=$(curl "$@" 2>&1) && { echo "$result"; return 0; }
    local exit_code=$?
    if [ "$exit_code" -eq 6 ] || [ "$exit_code" -eq 28 ]; then
      local reason=$( [ "$exit_code" -eq 6 ] && echo "DNS resolution failed" || echo "Request timed out" )
      echo "  Retry $attempt/3: ${reason}, waiting 5s..." >&2
      sleep 5
    else
      echo "$result"
      return $exit_code
    fi
  done
  echo "$result"
  return "$exit_code"
}

call_api() {
  local method="$1" url="$2" bodyfile="$3"
  retry_curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    --connect-timeout 10 --max-time 60 \
    --data-binary "@${bodyfile}"
}

deploy_workflow() {
  local file="$1"
  local filename
  filename=$(basename "$file")
  echo "----------------------------------------"
  echo "Deploying: $filename"

  # ワークフローIDと名前を抽出
  local wf_id wf_name wf_active
  wf_id=$(jq -r '.id' "$file")
  wf_name=$(jq -r '.name' "$file")
  wf_active=$(jq -r '.active' "$file")

  if [ "$wf_id" = "null" ] || [ -z "$wf_id" ]; then
    echo "  SKIP: id not found in $filename"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  echo "  ID: $wf_id"
  echo "  Name: $wf_name"
  echo "  Active: $wf_active"

  # 外部化されたCode Nodeを埋め戻してからフィルタリング
  # NOTE: jqの出力をファイル経由でcurlに渡す（-d "$var" だと $ がbashに解釈される）
  local bodyfile embedded_file
  bodyfile=$(mktemp)
  embedded_file=$(mktemp)
  # shellcheck disable=SC2064
  trap "rm -f '$bodyfile' '$embedded_file'" RETURN
  python3 "$(dirname "$0")/embed_code.py" "$file" > "$embedded_file"
  jq "$BODY_FILTER" "$embedded_file" > "$bodyfile"

  # 既存ワークフローの存在確認 → PUT(更新) or POST(新規)
  local check_code
  check_code=$(retry_curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 --max-time 30 \
    "${N8N_API_URL}/workflows/${wf_id}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}")

  local method url ok_codes
  case "$check_code" in
    200)
      echo "  Updating existing workflow..."
      method="PUT"
      url="${N8N_API_URL}/workflows/${wf_id}"
      ok_codes="200"
      ;;
    404)
      echo "  Creating new workflow..."
      method="POST"
      url="${N8N_API_URL}/workflows"
      ok_codes="200 201"
      ;;
    *)
      echo "  FAIL: Could not check workflow (HTTP $check_code)"
      FAIL=$((FAIL + 1))
      return
      ;;
  esac

  local result resp_code resp_body
  result=$(call_api "$method" "$url" "$bodyfile")
  resp_code=$(echo "$result" | tail -1)
  resp_body=$(echo "$result" | sed '$d')

  # shellcheck disable=SC2076
  if [[ " $ok_codes " =~ " $resp_code " ]]; then
    echo "  Success: HTTP $resp_code"
    if [ "$method" = "POST" ]; then
      local new_id
      new_id=$(echo "$resp_body" | jq -r '.id')
      if [ "$new_id" != "$wf_id" ]; then
        echo "  WARNING: New ID ($new_id) differs from file ID ($wf_id). Update the JSON file."
      fi
      wf_id="$new_id"
    fi
  else
    echo "  FAIL: HTTP $resp_code"
    [ -n "$resp_body" ] && echo "  Response: $resp_body"
    FAIL=$((FAIL + 1))
    return
  fi

  # active フラグに応じて activate/deactivate
  local toggle
  toggle=$([ "$wf_active" = "true" ] && echo "activate" || echo "deactivate")
  local toggle_code
  toggle_code=$(retry_curl -s -o /dev/null -w "%{http_code}" -X POST \
    --connect-timeout 10 --max-time 30 \
    "${N8N_API_URL}/workflows/${wf_id}/${toggle}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}")
  sleep 1  # レートリミット対策
  echo "  ${toggle^}: HTTP $toggle_code"

  SUCCESS=$((SUCCESS + 1))
}

echo "========================================"
echo "n8n Workflow Deploy"
echo "Target: $N8N_API_URL"
echo "========================================"

# 変更されたワークフローファイルを検出
CHANGED_FILES=""
if [ "${DEPLOY_ALL:-false}" = "true" ]; then
  echo "Mode: Deploy ALL workflows"
  CHANGED_FILES=$(find workflows/ -name '*.json' -type f)
elif [ -n "${DEPLOY_FILES:-}" ]; then
  echo "Mode: Deploy specified files"
  CHANGED_FILES="$DEPLOY_FILES"
else
  echo "Mode: Deploy changed files (git diff)"
  # 変更された .json を取得
  JSON_CHANGES=$(git diff --name-only HEAD~1 -- 'workflows/*.json' 2>/dev/null || true)

  # 変更された .ts から対応する .json を特定
  TS_CHANGES=$(git diff --name-only HEAD~1 -- 'workflows/code-nodes/' 2>/dev/null || true)
  TS_JSON_TARGETS=""
  if [ -n "$TS_CHANGES" ]; then
    HAS_SHARED=false
    for ts_file in $TS_CHANGES; do
      # code-nodes/{wf-name}/Node.ts → workflows/{wf-name}.json
      wf_dir=$(echo "$ts_file" | sed 's|workflows/code-nodes/||' | cut -d'/' -f1)
      if [ "$wf_dir" = "_shared" ]; then
        HAS_SHARED=true
      else
        # code-nodes/{wf-dir}/ の変更 → workflows/{wf-dir}*.json を全て対象にする
        # 例: shirankedo-daily/ → shirankedo-daily.json, shirankedo-daily-articles.json, ...
        for json in workflows/${wf_dir}*.json; do
          [ -f "$json" ] && TS_JSON_TARGETS="${TS_JSON_TARGETS} ${json}"
        done
      fi
    done
    # _shared 変更時: @external を含む全WFを対象にする
    if [ "$HAS_SHARED" = true ]; then
      for json in workflows/*.json; do
        if grep -q '@external' "$json" 2>/dev/null; then
          TS_JSON_TARGETS="${TS_JSON_TARGETS} ${json}"
        fi
      done
    fi
  fi

  # マージして重複除去
  CHANGED_FILES=$(printf '%s\n%s' "$JSON_CHANGES" "$TS_JSON_TARGETS" | tr ' ' '\n' | sort -u | grep -v '^$' || true)
fi

if [ -z "$CHANGED_FILES" ]; then
  echo ""
  echo "No workflow files to deploy."
  exit 0
fi

echo ""
echo "Files to deploy:"
echo "$CHANGED_FILES" | while read -r f; do echo "  - $f"; done
echo ""

# 各ファイルをデプロイ（whileのサブシェル問題を回避するためファイルリストを使用）
tmpfile=$(mktemp)
echo "$CHANGED_FILES" > "$tmpfile"

while IFS= read -r file; do
  if [ -f "$file" ]; then
    deploy_workflow "$file"
  else
    echo "SKIP: $file (not found)"
    SKIPPED=$((SKIPPED + 1))
  fi
done < "$tmpfile"
rm -f "$tmpfile"

echo ""
echo "========================================"
echo "Deploy Complete"
echo "  Success: $SUCCESS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIPPED"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
