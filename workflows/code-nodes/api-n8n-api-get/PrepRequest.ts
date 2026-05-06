/**
 * Webhook 入力 ({action: "<endpoint>"}) を HTTP Request 用パラメータに整形。
 *
 * 入力例:
 *   { action: "workflows?limit=200" }
 *   { action: "executions?status=error&limit=50" }
 *   { action: "workflows/abc123" }
 *
 * 出力:
 *   { url: "http://localhost:5678/api/v1/<endpoint>" }
 *
 * 使い手 (webhook.py n8n-api-get "workflows?limit=200") では action が n8n REST
 * API の path そのままになるため、ここで base URL を前置してフルパスを組み立てる
 * だけのシンプルな整形。method は GET 固定 (現状用途は workflows / executions の
 * 取得のみで POST/DELETE は別途必要なら拡張する)。
 */
const N8N_API_BASE = "http://localhost:5678/api/v1";

export default function (): CodeNodeReturn {
  const json = $input.first().json as IDataObject;
  const body = (json.body || json) as IDataObject;
  const rawAction = String(body.action || "").trim();

  if (!rawAction) {
    throw new Error("PrepRequest: 'action' は必須 (例: 'workflows?limit=200')");
  }

  // 先頭スラッシュは除去 (誤って `/workflows` と渡されてもエラーにしない)
  const endpoint = rawAction.replace(/^\/+/, "");

  return [
    {
      json: {
        url: `${N8N_API_BASE}/${endpoint}`,
        endpoint,
      },
    },
  ];
}
