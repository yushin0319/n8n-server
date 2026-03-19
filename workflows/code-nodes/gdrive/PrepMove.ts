import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["file_id", "folder_id"],
  });
  if (params._error) return [{ json: params }];
  return [{ json: { fileId: params.file_id, folderId: params.folder_id } }];
}
