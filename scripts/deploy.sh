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

  # PUT用のbodyをフィルタリング（許可フィールドのみ）
  # NOTE: jqの出力をファイル経由でcurlに渡す（-d "$var" だと $ がbashに解釈される）
  local bodyfile
  bodyfile=$(mktemp)
  jq "$BODY_FILTER" "$file" > "$bodyfile"

  # 既存ワークフローの存在確認
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    "${N8N_API_URL}/workflows/${wf_id}" \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}")

  if [ "$http_code" = "200" ]; then
    # 既存 → PUT で更新
    echo "  Updating existing workflow..."
    local result
    result=$(curl -s -w "\n%{http_code}" -X PUT \
      "${N8N_API_URL}/workflows/${wf_id}" \
      -H "Content-Type: application/json" \
      -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
      --data-binary "@${bodyfile}")

    local resp_code
    resp_code=$(echo "$result" | tail -1)

    if [ "$resp_code" = "200" ]; then
      echo "  Updated successfully"
    else
      local resp_body
      resp_body=$(echo "$result" | sed '$d')
      echo "  FAIL: HTTP $resp_code"
      echo "  Response: $resp_body"
      FAIL=$((FAIL + 1))
      rm -f "$bodyfile"
      return
    fi
  elif [ "$http_code" = "404" ]; then
    # 新規 → POST で作成
    echo "  Creating new workflow..."
    local result
    result=$(curl -s -w "\n%{http_code}" -X POST \
      "${N8N_API_URL}/workflows" \
      -H "Content-Type: application/json" \
      -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
      --data-binary "@${bodyfile}")

    local resp_code
    resp_code=$(echo "$result" | tail -1)

    if [ "$resp_code" = "200" ] || [ "$resp_code" = "201" ]; then
      echo "  Created successfully"
      local new_id
      new_id=$(echo "$result" | sed '$d' | jq -r '.id')
      if [ "$new_id" != "$wf_id" ]; then
        echo "  WARNING: New ID ($new_id) differs from file ID ($wf_id). Update the JSON file."
      fi
      wf_id="$new_id"
    else
      echo "  FAIL: HTTP $resp_code"
      FAIL=$((FAIL + 1))
      rm -f "$bodyfile"
      return
    fi
  else
    echo "  FAIL: Could not check workflow (HTTP $http_code)"
    FAIL=$((FAIL + 1))
    rm -f "$bodyfile"
    return
  fi

  rm -f "$bodyfile"

  # active フラグに応じて activate/deactivate
  if [ "$wf_active" = "true" ]; then
    local act_code
    act_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "${N8N_API_URL}/workflows/${wf_id}/activate" \
      -H "X-N8N-API-KEY: ${N8N_API_KEY}")
    echo "  Activate: HTTP $act_code"
  else
    local deact_code
    deact_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      "${N8N_API_URL}/workflows/${wf_id}/deactivate" \
      -H "X-N8N-API-KEY: ${N8N_API_KEY}")
    echo "  Deactivate: HTTP $deact_code"
  fi

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
  CHANGED_FILES=$(git diff --name-only HEAD~1 -- 'workflows/*.json' 2>/dev/null || true)
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
