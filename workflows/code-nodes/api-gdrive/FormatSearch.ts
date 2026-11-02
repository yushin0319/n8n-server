// fileFolder.search ネイティブノードは複数アイテムを返す（1ファイル=1アイテム）
// $input.all() で全件取得し、統一フォーマットに変換
export default function (): CodeNodeReturn {
  // 0 件のとき前のノードが alwaysOutputData で流す空の 1 件を除く
  const items = $input.all().filter((item) => item.json.id);
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
