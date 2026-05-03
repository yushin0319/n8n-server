import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const total = (r.total as number) || 0;
  const errors = (r.errors as number) || 0;
  const isError = errors > 0;
  return [
    {
      json: obsNotifyFromCron({
        label: "Star取得",
        isError,
        detail: isError ? `${total}件成功, ${errors}件エラー` : `${total}件`,
        service: "n8n",
        repo: "shirankedo",
        raw_payload: isError ? r : undefined,
      }),
    },
  ];
}
