export default function (): CodeNodeReturn {
  // 0 件のとき前の Notion ノードが alwaysOutputData で流す空の 1 件を除く
  const pages = $input.all().filter((item) => item.json.id);
  const tasks = pages.map((item) => {
    // biome-ignore lint/suspicious/noExplicitAny: Notion API レスポンス構造は複雑なため
    const p = item.json as any;
    const props = p.properties;
    return {
      id: p.id as string,
      name: (props[""]?.title?.[0]?.plain_text as string) || "",
      frequency: (props.頻度?.multi_select?.[0]?.name as string) || null,
      next_date: (props.次回予定日?.date?.start as string) || null,
      last_executed: (props.最終実行日?.date?.start as string) || null,
      taskTemplate:
        (props.テンプレ本文?.rich_text?.[0]?.plain_text as string) || "",
      enabled: (props.有効?.checkbox as boolean) ?? true,
      url: p.url as string,
    };
  });
  return [{ json: { action: "list", count: tasks.length, tasks } }];
}
