import { formatError } from "../_shared/formatError";
import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const result = $input.first().json;
  const count = ($("FormatArticles").first().json.articleCount as number) || 0;
  const isError =
    !!result.error ||
    (result.statusCode && (result.statusCode as number) >= 400);
  return [
    {
      json: obsNotifyFromCron({
        label: "shirankedo 記事更新完了",
        isError: !!isError,
        detail: isError
          ? formatError(result.error ?? result.message ?? result)
          : `${count}件追加`,
        service: "n8n",
        repo: "shirankedo",
        raw_payload: isError ? result : undefined,
      }),
    },
  ];
}
