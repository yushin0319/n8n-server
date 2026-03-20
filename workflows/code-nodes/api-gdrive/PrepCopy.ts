import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["file_id"],
    optional: { name: "", folder_id: "" },
  });
  if (params._error) return [{ json: params }];

  const hasDest = params.folder_id !== "";
  return [
    {
      json: {
        fileId: params.file_id,
        name: params.name || undefined,
        sameFolder: !hasDest,
        folderId: hasDest ? params.folder_id : undefined,
      },
    },
  ];
}
