import { formatError } from "../_shared/formatError";
import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const input = $input.first().json;
  const count = ($("MergeReleasePaths").first().json.count as number) || 0;
  const isError =
    !!input.error || (input.statusCode && (input.statusCode as number) >= 400);
  return [
    {
      json: obsNotifyFromCron({
        label: "shirankedo リリース更新完了",
        isError: !!isError,
        detail: isError
          ? formatError(input.error ?? input.message ?? input)
          : `${count}件`,
        service: "n8n",
        repo: "shirankedo",
        raw_payload: isError ? input : undefined,
      }),
    },
  ];
}
