import { discordMessage } from "../_shared/discordMessage";

export default function (): CodeNodeReturn {
  const r = $input.first().json;
  const ok = r.ok !== undefined ? (r.ok as boolean) : false;
  const msg = ok
    ? discordMessage({
        label: "ページコメント生成完了",
        isError: false,
        detail: "3件",
      })
    : discordMessage({
        label: "ページコメント生成失敗",
        isError: true,
        detail:
          (r.message as string) || JSON.stringify(r).substring(0, 200),
      });
  return [{ json: { message: msg } }];
}
