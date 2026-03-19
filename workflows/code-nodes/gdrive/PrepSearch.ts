import { prepParams } from "../_shared/prepParams";

// fileFolder.search ネイティブノード用パラメータを準備
// 旧 list (folder_id指定) + 旧 search (name検索) を統合
export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    optional: { query: "", folder_id: "", mime_type: "", limit: 50 },
  });

  const hasQuery = params.query !== "";
  return [
    {
      json: {
        searchMethod: hasQuery ? "name" : "query",
        queryString: hasQuery ? params.query : "",
        folderId: params.folder_id || undefined,
        mimeType: params.mime_type || undefined,
        limit: params.limit,
      },
    },
  ];
}
