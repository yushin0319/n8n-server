export default function (): CodeNodeReturn {
  // delete用: page_idを取得
  const body = $input.first().json.body;
  return [{ json: { pageId: body.page_id } }];
}
