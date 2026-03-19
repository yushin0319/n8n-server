import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["file_id"],
    optional: {
      role: "reader",
      type: "anyone",
      email_address: undefined,
      domain: undefined,
    },
  });
  if (params._error) return [{ json: params }];

  const shareType = params.type as string;

  // type別バリデーション
  if (
    (shareType === "user" || shareType === "group") &&
    !params.email_address
  ) {
    return [
      {
        json: {
          _error: true,
          message: "email_address is required when type is user or group",
        },
      },
    ];
  }
  if (shareType === "domain" && !params.domain) {
    return [
      {
        json: {
          _error: true,
          message: "domain is required when type is domain",
        },
      },
    ];
  }

  const json: Record<string, string> = {
    fileId: params.file_id as string,
    role: params.role as string,
    shareType,
  };
  // type=anyone では emailAddress/domain を含めない（空文字列でGoogle APIエラー回避）
  if (params.email_address) json.emailAddress = params.email_address as string;
  if (params.domain) json.domain = params.domain as string;

  return [{ json }];
}
