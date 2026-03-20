export default function (): CodeNodeReturn {
  // list結果をフォーマット
  const results = $input.first().json.results || [];
  const tasks = results.map((p) => {
    const props = p.properties;
    return {
      id: p.id,
      name: props[""]?.title?.[0]?.plain_text || "",
      frequency: props["頻度"]?.multi_select?.[0]?.name || null,
      next_date: props["次回予定日"]?.date?.start || null,
      last_executed: props["最終実行日"]?.date?.start || null,
      taskTemplate: props["テンプレ本文"]?.rich_text?.[0]?.plain_text || "",
      enabled: props["有効"]?.checkbox ?? true,
      url: p.url,
    };
  });
  return [{ json: { action: "list", count: tasks.length, tasks } }];
}
