import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const ok = r.ok !== undefined ? (r.ok as boolean) : false;
  return [
    {
      json: ok
        ? obsNotifyFromCron({
            label: "週次レポート生成完了",
            isError: false,
            service: "n8n",
            repo: "shirankedo",
          })
        : obsNotifyFromCron({
            label: "週次レポート生成失敗",
            isError: true,
            detail:
              (r.message as string) || JSON.stringify(r).substring(0, 200),
            service: "n8n",
            repo: "shirankedo",
            raw_payload: r,
          }),
    },
  ];
}
