import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  if (r.message) {
    // 上流の skip / カスタムメッセージを尊重して info で流す
    return [
      {
        json: obsNotifyFromCron({
          label: "TrackingRepo更新",
          isError: false,
          detail: r.message as string,
          service: "n8n",
          repo: "shirankedo",
        }),
      },
    ];
  }
  const total = (r.total as number) || 0;
  const errors = (r.errors as number) || 0;
  const isError = errors > 0;
  return [
    {
      json: obsNotifyFromCron({
        label: "TrackingRepo更新",
        isError,
        detail: isError
          ? `${total}件追加, ${errors}件エラー`
          : `${total}件追加`,
        service: "n8n",
        repo: "shirankedo",
        raw_payload: isError ? r : undefined,
      }),
    },
  ];
}
