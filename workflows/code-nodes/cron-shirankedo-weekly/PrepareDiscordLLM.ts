import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const ok = r.ok !== undefined ? (r.ok as boolean) : false;
  const count = (r.inserted as number) || 0;
  const updated = (r.updated as number) || 0;
  return [
    {
      json: ok
        ? obsNotifyFromCron({
            label: "LLM価格更新完了",
            isError: false,
            detail: `${count}件追加, ${updated}件更新`,
            service: "n8n",
            repo: "shirankedo",
          })
        : obsNotifyFromCron({
            label: "LLM価格更新失敗",
            isError: true,
            detail: JSON.stringify(r).substring(0, 200),
            service: "n8n",
            repo: "shirankedo",
            raw_payload: r,
          }),
    },
  ];
}
