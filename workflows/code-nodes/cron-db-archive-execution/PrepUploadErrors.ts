/**
 * Phase 2: 失敗 execution の詳細スナップショット (includeData=true 取得分) を
 * YYYY-MM-DD-errors.jsonl に整形する。各 execution の data フィールド (各ノードの
 * input/output) を含むためバグ調査用。
 *
 * Phase 1 の PrepUpload と異なり ids は持たない (DELETE は Phase 1 のメタ ids で
 * 一括実行する設計のため)。
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
  const resp = $input.first().json as IDataObject;
  const executions = (resp?.data || []) as ExecutionRow[];

  // 1 行 1 execution の JSONL に整形 (data フィールド含む詳細版)
  const jsonl = executions.map((ex) => JSON.stringify(ex)).join("\n");

  // ファイル名 (JST 日付 + -errors サフィックス)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = jst.toISOString().slice(0, 10);
  const fileName = `${dateStr}-errors.jsonl`;

  const base64 = Buffer.from(jsonl, "utf-8").toString("base64");

  return [
    {
      json: {
        name: fileName,
        folderId: N8N_LOGS_FOLDER_ID,
        count: executions.length,
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
