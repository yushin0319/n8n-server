export default function (): CodeNodeReturn {
  const input = $input.first().json.body || $input.first().json;
  const pageId = input.page_id;
  if (!pageId) {
    throw new Error("page_id is required for get action");
  }
  return [{ json: { pageId } }];
}
