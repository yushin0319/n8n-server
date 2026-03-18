export default function (): CodeNodeReturn {
  const result = $input.first().json;
  const commits = (result.items || []) as IDataObject[];

  // リポジトリ別にグループ化
  const repos: Record<string, string[]> = {};
  const totalCommits = commits.length;

  for (const item of commits) {
    const repoName = (item.repository as IDataObject).full_name as string;
    if (!repos[repoName]) repos[repoName] = [];
    const msg = ((item.commit as IDataObject).message as string).split("\n")[0];
    repos[repoName].push(msg);
  }

  // JST date for title
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(Date.now() + jstOffset);
  const todayStr = jstNow.toISOString().substring(0, 10);
  const title = `GitHub活動 ${todayStr}`;

  const children: IDataObject[] = [];

  for (const [repo, messages] of Object.entries(repos)) {
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ type: "text", text: { content: repo } }] },
    });
    for (const msg of messages) {
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: msg.substring(0, 2000) } },
          ],
        },
      });
    }
  }

  const requestBody = {
    parent: { database_id: "2a02570f-e49f-802b-a67c-fe4c230a5699" },
    properties: {
      "": { title: [{ text: { content: title } }] },
      ステータス: { status: { name: "完了" } },
    },
    children,
  };

  return [
    { json: { requestBody: JSON.stringify(requestBody), totalCommits, title } },
  ];
}
