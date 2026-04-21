import { randomCover } from "../_shared/covers";
import { mdToBlocks, parseRichText } from "../_shared/notionBlocks";

export { mdToBlocks, parseRichText };

export default function (): CodeNodeReturn {
  const input = $input.first().json.body || $input.first().json;
  const name = (input.name as string) || "新しいタスク";
  const parentId = (input.parent_id as string) || null;
  const taskContent = (input.content as string) || null;

  const coverUrl = (input.cover_url as string) || randomCover();

  const body: IDataObject = {
    parent: { database_id: "2a02570f-e49f-802b-a67c-fe4c230a5699" },
    properties: {
      "": { title: [{ text: { content: name } }] },
    },
    cover: { type: "external", external: { url: coverUrl } },
  };

  if (parentId) {
    (body.properties as IDataObject).親タスク = {
      relation: [{ id: parentId }],
    };
  }

  if (taskContent) {
    body.children = mdToBlocks(taskContent);
  }

  return [{ json: { requestBody: JSON.stringify(body) } }];
}
