export default function (): CodeNodeReturn {
  // delete用: page_idを取得
  const body = $input.first().json?.body as Record<string, unknown> | undefined;
  const pageId = body?.page_id as string | undefined;
  if (!pageId) throw new Error("body.page_id は必須です");
  return [{ json: { pageId } }];
}
