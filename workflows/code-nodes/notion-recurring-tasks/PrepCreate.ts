export default function (): CodeNodeReturn {
  // create用リクエストボディを構築
  const body = $input.first().json.body;
  const name = body.name;
  const frequency = body.frequency || "毎週";
  const nextDate = body.next_date || null;
  const taskTemplate = body.template || "";
  const enabled = body.enabled !== undefined ? body.enabled : true;

  const properties = {
    "": { title: [{ text: { content: name } }] },
    頻度: { multi_select: [{ name: frequency }] },
    有効: { checkbox: enabled },
  };
  if (nextDate) {
    properties["次回予定日"] = { date: { start: nextDate } };
  }
  if (taskTemplate) {
    properties["テンプレ本文"] = {
      rich_text: [{ text: { content: taskTemplate } }],
    };
  }

  // NOTE: 定期タスク定義DB ID（n8n Code Nodeでは環境変数不可のためハードコード）
  const requestBody = JSON.stringify({
    parent: { database_id: "3142570f-e49f-80cf-8383-cc62030339c9" },
    properties,
  });

  return [{ json: { requestBody } }];
}
