import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    optional: {
      name: "untitled.txt",
      content: "",
      folder_id: "root",
      mime_type: "text/plain",
      encoding: "utf-8",
    },
  });
  return [
    {
      json: {
        name: params.name,
        fileContent: params.content,
        folderId: params.folder_id,
        mimeType: params.mime_type,
        encoding: params.encoding,
      },
    },
  ];
}
