/**
 * Phase 2: 失敗 execution の一覧を YYYY-MM-DD-errors.jsonl に整形する。
 *
 * 2026-10-23 変更: FetchErrors は includeData=false (メタデータのみ) で取る。
 * includeData=true は「期間に関係なく新しい順 50 件を中身ごと」1 回で取るため、
 * 取り込み系の失敗 (1 件約 0.9MB) や失敗した db-archive 自身が混ざると n8n 本体の
 * V8 heap 256MB を超え、2026-10-19〜22 は毎晩 03:0x JST にコンテナごと落ちた。
 * 失敗の要約 (止まったノード・エラー文・生データ) は system/error-handler が
 * 観測性 DB に送っている。scripts/lint_execute_once.py が一覧の includeData=true を
 * ERROR にする。下の data フィールドの扱いは、項目があれば残すだけ。
 *
 * pagination 対応: HTTP Request node の pagination 機能で複数 page 来るとき、
 * 各 page が個別 item として渡るため $input.all() で全 page を集約する。
 *
 * range filter: n8n REST API の /executions は startedAfter クエリを未対応のため
 * (v2.6.3 で "Unknown query parameter" エラー)、API 側は startedBefore のみで取得し、
 * Code Node 側で startedAt >= from の execution のみ残す。
 *
 * 1 行目に {"_meta":{"from":..., "to":...}} を入れて対象範囲を明示 (Notion #561)。
 *
 * 2026-08-11 追記 (件数上限):
 * includeData=true の 1 件は実測 34-38KB (data 28-30KB + workflowData 6-8KB) ある。
 * JSONL 文字列と base64 (1.33 倍) を同時に heap 上へ載せるため、件数が伸びると
 * 512MB コンテナの V8 heap limit (256MB) を押し切る。主対策は PrepRange の
 * 窓クランプだが、窓内に error が集中した日でも落ちないよう件数上限を設ける。
 * 打ち切った場合は _meta.truncated / dropped に残して隠さない。
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
const MAX_ERROR_ROWS = 200;

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

  // 上限超過時は先頭から採用する。n8n の GET /executions は id 降順 (新しい順) で
  // 返すため、これは「直近の error を優先して残す」と同義になる (2026-08-11 実測)。
  // ここで並べ替えないのは、正常時の行順を API の返却順のまま保つため。
  const kept = filtered.slice(0, MAX_ERROR_ROWS);
  const dropped = filtered.length - kept.length;

  const meta = JSON.stringify({
    _meta: {
      from,
      to,
      truncated: dropped > 0,
      dropped,
      max_rows: MAX_ERROR_ROWS,
    },
  });
  const jsonl = [meta, ...kept.map((ex) => JSON.stringify(ex))].join("\n");

  const fileName = `${fileDate}-errors.jsonl`;
  const base64 = Buffer.from(jsonl, "utf-8").toString("base64");

  return [
    {
      json: {
        name: fileName,
        folderId: N8N_LOGS_FOLDER_ID,
        count: kept.length,
        dropped,
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
