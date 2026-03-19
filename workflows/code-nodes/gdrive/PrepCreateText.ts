import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["content"],
    optional: { name: "Untitled", folder_id: "root" },
  });
  if (params._error) return [{ json: params }];
  return [
    {
      json: {
        content: params.content,
        name: params.name,
        folderId: params.folder_id,
      },
    },
  ];
}
