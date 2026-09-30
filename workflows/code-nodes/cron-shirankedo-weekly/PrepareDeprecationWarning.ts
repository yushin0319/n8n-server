import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

/** 廃止一覧の取得・解析で警告があれば obs-notify（warning）に送る。無ければ何も出力しない */
export default function (): CodeNodeReturn {
  const warnings = ($input.first().json.deprecationWarnings ?? []) as string[];
  if (warnings.length === 0) return [];
  return [
    {
      json: obsNotifyFromCron({
        label: "LLM 廃止一覧の取得・解析に失敗（該当社は除外なしで継続）",
        isError: true,
        detail: warnings.join(" / ").substring(0, 500),
        service: "n8n",
        repo: "shirankedo",
        raw_payload: { warnings },
      }),
    },
  ];
}
