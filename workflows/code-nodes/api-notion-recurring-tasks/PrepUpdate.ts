export default function (): CodeNodeReturn {
  // update用リクエストボディを構築
  const body = $input.first().json?.body as Record<string, unknown> | undefined;
  const pageId = body?.page_id as string | undefined;
  if (!body || !pageId) throw new Error("body.page_id は必須です");

  const properties: Record<string, unknown> = {};
  if (body.name !== undefined) {
    properties[""] = {
      title: [{ text: { content: (body.name as string) || "" } }],
    };
  }
  if (body.frequency !== undefined) {
    properties.頻度 = {
      multi_select: [{ name: (body.frequency as string) || "" }],
    };
  }
  if (body.next_date !== undefined) {
    properties.次回予定日 = {
      date: body.next_date ? { start: body.next_date as string } : null,
    };
  }
  if (body.template !== undefined) {
    properties.テンプレ本文 = {
      rich_text: [{ text: { content: (body.template as string) || "" } }],
    };
  }
  if (body.enabled !== undefined) {
    properties.有効 = { checkbox: body.enabled };
  }

  const requestBody = JSON.stringify({ properties });
  return [{ json: { pageId, requestBody } }];
}
