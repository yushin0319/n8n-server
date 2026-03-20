export default function (): CodeNodeReturn {
  // update用リクエストボディを構築
  const body = $input.first().json.body;
  const pageId = body.page_id;

  const properties = {};
  if (body.name !== undefined) {
    properties[""] = { title: [{ text: { content: body.name } }] };
  }
  if (body.frequency !== undefined) {
    properties["頻度"] = { multi_select: [{ name: body.frequency }] };
  }
  if (body.next_date !== undefined) {
    properties["次回予定日"] = {
      date: body.next_date ? { start: body.next_date } : null,
    };
  }
  if (body.template !== undefined) {
    properties["テンプレ本文"] = {
      rich_text: [{ text: { content: body.template } }],
    };
  }
  if (body.enabled !== undefined) {
    properties["有効"] = { checkbox: body.enabled };
  }

  const requestBody = JSON.stringify({ properties });
  return [{ json: { pageId, requestBody } }];
}
