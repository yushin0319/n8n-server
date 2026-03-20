import { randomCover } from "../_shared/covers";

export default function (): CodeNodeReturn {
  const items = $input.all();
  return items.map((item) => {
    const d = item.json;
    const coverUrl = randomCover();
    const body: IDataObject = {
      parent: { database_id: "2a02570f-e49f-802b-a67c-fe4c230a5699" },
      properties: {
        "": { title: [{ text: { content: d.taskName } }] },
        ステータス: { status: { name: "未着手" } },
      },
      cover: { type: "external", external: { url: coverUrl } },
    };
    if (d.templateText) {
      body.children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: d.templateText } }],
          },
        },
      ];
    }
    return { json: { ...d, requestBody: JSON.stringify(body) } };
  });
}
