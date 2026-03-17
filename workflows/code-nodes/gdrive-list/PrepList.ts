import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    optional: { folder_id: "root", page_size: 20, page_token: "" },
  });
  const folderId = params.folder_id as string;
  const q = `'${folderId}' in parents and trashed = false`;
  const fields =
    "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)";
  return [
    {
      json: {
        q,
        pageSize: params.page_size,
        fields,
        pageToken: params.page_token,
      },
    },
  ];
}
