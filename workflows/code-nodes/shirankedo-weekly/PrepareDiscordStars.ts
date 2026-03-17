import { discordMessage } from "../_shared/discordMessage";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const total = (r.total as number) || 0;
  const errors = (r.errors as number) || 0;
  const msg = discordMessage({
    label: "Star取得",
    isError: errors > 0,
    detail: errors > 0 ? `${total}件成功, ${errors}件エラー` : `${total}件`,
  });
  return [{ json: { message: msg } }];
}
