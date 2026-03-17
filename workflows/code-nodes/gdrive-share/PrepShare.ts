import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["file_id"],
    optional: { role: "reader", type: "anyone" },
  });
  return [
    {
      json: {
        fileId: params.file_id,
        role: params.role,
        shareType: params.type,
      },
    },
  ];
}
