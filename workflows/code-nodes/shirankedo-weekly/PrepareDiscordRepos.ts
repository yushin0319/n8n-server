import { discordMessage } from "../_shared/discordMessage";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  if (r.message) return [{ json: { message: r.message as string } }];
  const total = (r.total as number) || 0;
  const errors = (r.errors as number) || 0;
  const msg = discordMessage({
    label: "TrackingRepo更新",
    isError: errors > 0,
    detail: errors > 0 ? `${total}件追加, ${errors}件エラー` : `${total}件追加`,
  });
  return [{ json: { message: msg } }];
}
