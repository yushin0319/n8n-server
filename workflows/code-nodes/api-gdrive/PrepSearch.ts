import { prepParams } from "../_shared/prepParams";

// fileFolder.search ネイティブノード用パラメータを準備
// 旧 list (folder_id指定) + 旧 search (name検索) を統合
export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    optional: { query: "", folder_id: "", mime_type: "", limit: 50 },
  });

  const query = params.query as string;
  const folderId = params.folder_id as string;
  const mimeType = params.mime_type as string;

  // Google Drive API クエリを組み立て
  const conditions: string[] = [];
  if (query) conditions.push(`name contains '${query}'`);
  if (folderId) conditions.push(`'${folderId}' in parents`);
  if (mimeType) conditions.push(`mimeType = '${mimeType}'`);
  conditions.push("trashed = false");

  return [
    {
      json: {
        searchMethod: "query",
        queryString: conditions.join(" and "),
        limit: params.limit,
      },
    },
  ];
}
