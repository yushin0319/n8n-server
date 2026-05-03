import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return [
    {
      json: obsNotifyFromCron({
        label: "HistLink Backend DOWN",
        isError: true,
        detail: `${now} にヘルスチェックが失敗しました。`,
        service: "n8n",
        repo: "n8n-server",
        severity: "warning",
      }),
    },
  ];
}
