import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["folder_id"],
    optional: { role: "reader", type: "anyone" },
  });
  if (params._error) return [{ json: params }];
  return [
    {
      json: {
        folderId: params.folder_id,
        role: params.role,
        shareType: params.type,
      },
    },
  ];
}
