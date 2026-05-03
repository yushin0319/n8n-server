import { formatError } from "../_shared/formatError";
import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  const input = $input.first().json;
  const vulnCount =
    ($("PrepareSecurityComment").first().json.vulnCount as number) || 0;
  const releaseCount =
    ($("PrepareSecurityComment").first().json.releaseCount as number) || 0;
  const isError =
    !!input.error || (input.statusCode && (input.statusCode as number) >= 400);
  return [
    {
      json: obsNotifyFromCron({
        label: "shirankedo セキュリティ日次更新完了",
        isError: !!isError,
        detail: isError
          ? formatError(input.error ?? input.message ?? input)
          : `脆弱性${vulnCount}件、リリース${releaseCount}件`,
        service: "n8n",
        repo: "shirankedo",
        raw_payload: isError ? input : undefined,
      }),
    },
  ];
}
