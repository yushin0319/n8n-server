import { discordMessage } from "../_shared/discordMessage";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const ok = r.ok !== undefined ? (r.ok as boolean) : false;
  const count = (r.inserted as number) || 0;
  const updated = (r.updated as number) || 0;
  const msg = ok
    ? discordMessage({
        label: "LLM価格更新完了",
        isError: false,
        detail: `${count}件追加, ${updated}件更新`,
      })
    : discordMessage({
        label: "LLM価格更新失敗",
        isError: true,
        detail: JSON.stringify(r).substring(0, 200),
      });
  return [{ json: { message: msg } }];
}
