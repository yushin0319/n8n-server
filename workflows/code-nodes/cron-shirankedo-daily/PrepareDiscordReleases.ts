import { discordMessage } from "../_shared/discordMessage";

export default function (): CodeNodeReturn {
  const input = $input.first().json;
  const count = ($("MergeReleasePaths").first().json.count as number) || 0;
  const isError =
    !!input.error || (input.statusCode && (input.statusCode as number) >= 400);
  const msg = discordMessage({
    label: "shirankedo リリース更新完了",
    isError: !!isError,
    detail: isError
      ? String(
          typeof input.error === "object"
            ? JSON.stringify(input.error)
            : input.error || input.message || "unknown",
        )
      : `${count}件`,
  });
  return [{ json: { message: msg } }];
}
