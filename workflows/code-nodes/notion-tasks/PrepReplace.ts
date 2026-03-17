export default function (): CodeNodeReturn {
  const input = $input.first().json.body || $input.first().json;
  const pageId = input.page_id;
  const taskContent = input.content || '';
  if (!pageId) throw new Error('page_id is required for replace action');
  if (!taskContent) throw new Error('content is required for replace action');
  return [{ json: { pageId, taskContent } }];
}
