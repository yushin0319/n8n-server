/**
 * Phase 2: 失敗 execution の詳細スナップショット (includeData=true) を
 * YYYY-MM-DD-errors.jsonl に整形する。各 execution の data フィールド
 * (各ノードの input/output) を含むためバグ調査用。
 *
 * pagination 対応: HTTP Request node の pagination 機能で複数 page 来るとき、
 * 各 page が個別 item として渡るため $input.all() で全 page を集約する。
 *
 * range filter: n8n REST API の /executions は startedAfter クエリを未対応のため
 * (v2.6.3 で "Unknown query parameter" エラー)、API 側は startedBefore のみで取得し、
 * Code Node 側で startedAt >= from の execution のみ残す。
 *
 * 1 行目に {"_meta":{"from":..., "to":...}} を入れて対象範囲を明示 (Notion #561)。
 */
interface ExecutionRow {
  id?: string;
  workflowId?: string;
  startedAt?: string;
  stoppedAt?: string;
  status?: string;
  data?: unknown;
}

const N8N_LOGS_FOLDER_ID = "1aOOhc_tKh7ZD3Mnr4LSbj6lSGWze_0Jl";

export default function (): CodeNodeReturn {
  const items = $input.all();
  const executions: ExecutionRow[] = [];
  for (const it of items) {
    const j = (it.json || {}) as IDataObject;
    const data = (j.data || []) as ExecutionRow[];
    if (Array.isArray(data)) executions.push(...data);
  }

  const range = $("PrepRange").first().json as IDataObject;
  const from = String(range?.from || "");
  const to = String(range?.to || "");
  let fileDate = String(range?.file_date || "");
  if (!fileDate) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    fileDate = jst.toISOString().slice(0, 10);
  }

  const fromMs = from ? Date.parse(from) : 0;
  const filtered = executions.filter((ex) => {
    if (!ex.startedAt) return false;
    const startedMs = Date.parse(ex.startedAt);
    return Number.isFinite(startedMs) && startedMs >= fromMs;
  });

  const meta = JSON.stringify({ _meta: { from, to } });
  const jsonl = [meta, ...filtered.map((ex) => JSON.stringify(ex))].join("\n");

  const fileName = `${fileDate}-errors.jsonl`;
  const base64 = Buffer.from(jsonl, "utf-8").toString("base64");

  return [
    {
      json: {
        name: fileName,
        folderId: N8N_LOGS_FOLDER_ID,
        count: filtered.length,
        from,
        to,
      },
      binary: {
        file: {
          data: base64,
          mimeType: "application/jsonl",
          fileName,
        },
      },
    },
  ];
}
