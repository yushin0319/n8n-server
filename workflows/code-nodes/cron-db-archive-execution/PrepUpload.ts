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

  // 1 行 1 execution の JSONL に整形
  const jsonl = executions.map((ex) => JSON.stringify(ex)).join("\n");

  // ファイル名 (JST 日付)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = jst.toISOString().slice(0, 10);
  const fileName = `${dateStr}-executions.jsonl`;

  // 削除対象 id 配列 (アップロード成功後に DELETE する)
  const ids = executions.map((ex) => String(ex.id || ""));

  // JSONL を base64 エンコードして binary として渡す
  const base64 = Buffer.from(jsonl, "utf-8").toString("base64");

  return [
    {
      json: {
        name: fileName,
        folderId: N8N_LOGS_FOLDER_ID,
        count: executions.length,
        ids,
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
