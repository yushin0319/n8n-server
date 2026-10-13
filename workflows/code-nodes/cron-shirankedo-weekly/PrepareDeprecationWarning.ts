import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

/** 廃止一覧の取得・解析で警告があれば obs-notify（warning）に送る。無ければ何も出力しない */
export default function (): CodeNodeReturn {
  const warnings = ($input.first().json.deprecationWarnings ?? []) as string[];
  if (warnings.length === 0) return [];
  return [
    {
      json: obsNotifyFromCron({
        // 社ごとの全滅（その社は除外なし）と、一部の停止日だけ読めない場合（その分は除外なし）の両方に当てはまる文言
        label: "LLM 廃止一覧の取得・解析で警告（読めなかった分は除外しない）",
        isError: true,
        detail: warnings.join(" / ").substring(0, 500),
        service: "n8n",
        repo: "shirankedo",
        raw_payload: { warnings },
      }),
    },
  ];
}
