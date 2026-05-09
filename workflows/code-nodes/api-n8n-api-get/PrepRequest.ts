/**
 * Webhook 入力 ({path|action: "<endpoint>"}) を HTTP Request 用パラメータに整形。
 *
 * 入力例:
 *   { path: "workflows?limit=200" }                              // 推奨
 *   { action: "executions?status=error&limit=50" }               // 旧仕様 (後方互換)
 *   { path: "workflows/abc123" }
 *
 * 出力:
 *   { url: "http://localhost:5678/api/v1/<endpoint>" }
 *
 * 使い手 (webhook.py n8n-api-get '{"path":"workflows?limit=200"}') では path /
 * action のいずれかが n8n REST API の path そのままになるため、ここで base URL
 * を前置してフルパスを組み立てるだけのシンプルな整形。
 *
 * Notion #559: 旧実装は body.action のみを読み、webhook.py が JSON body を
 * '{"path":"..."}' で送るとアクションが undefined → throw、または body 全体が
 * リテラル文字列として action に入って URL が ".../api/v1/{\"path\":\"...\"}" の
 * ように壊れていた (5/9 errors.jsonl で 7 件)。`path` フィールドを優先で受ける
 * ように拡張して両形式対応。method は GET 固定。
 */
const N8N_API_BASE = "http://localhost:5678/api/v1";

export default function (): CodeNodeReturn {
  const json = $input.first().json as IDataObject;
  const body = (json.body || json) as IDataObject;
  // path 優先、なければ旧仕様 action を見る
  const rawAction = String(body.path || body.action || "").trim();

  if (!rawAction) {
    throw new Error(
      "PrepRequest: 'path' (推奨) または 'action' (旧仕様) フィールドが必須 (例: { path: 'workflows?limit=200' })",
    );
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
