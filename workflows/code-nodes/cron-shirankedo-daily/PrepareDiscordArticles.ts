import { discordMessage } from "../_shared/discordMessage";
import { formatError } from "../_shared/formatError";

export default function (): CodeNodeReturn {
  const result = $input.first().json;
  const count = ($("FormatArticles").first().json.articleCount as number) || 0;
  const isError =
    !!result.error ||
    (result.statusCode && (result.statusCode as number) >= 400);
  const msg = discordMessage({
    label: "shirankedo 記事更新完了",
    isError: !!isError,
    detail: isError
      ? formatError(result.error ?? result.message ?? result)
      : `${count}件追加`,
  });
  return [{ json: { message: msg } }];
}
