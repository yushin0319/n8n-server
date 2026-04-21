// fileFolder.search ネイティブノードは複数アイテムを返す（1ファイル=1アイテム）
// $input.all() で全件取得し、統一フォーマットに変換
export default function (): CodeNodeReturn {
  const items = $input.all();
  const files = items.map((item: INodeExecutionData) => {
    const f = item.json;
    return {
      id: f.id,
      name: f.name,
      type: f.mimeType,
      size: f.size ? parseInt(f.size as string, 10) : null,
      modified: f.modifiedTime,
      url: f.webViewLink,
      parents: f.parents,
    };
  });
  return [{ json: { action: "search", count: files.length, files } }];
}
