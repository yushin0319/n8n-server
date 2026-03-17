import { parseRichText, mdToBlocks } from "../_shared/notionBlocks";

/** カバー画像URL候補 */
const COVERS = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc135?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1528164344705-47542687000d?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1516616370751-86d6bd8b0651?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1600&h=900&fit=crop",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&h=900&fit=crop",
];

export { parseRichText, mdToBlocks };

export default function (): CodeNodeReturn {
  const input = $input.first().json.body || $input.first().json;
  const name = (input.name as string) || "新しいタスク";
  const parentId = (input.parent_id as string) || null;
  const taskContent = (input.content as string) || null;

  const coverUrl =
    (input.cover_url as string) ||
    COVERS[Math.floor(Math.random() * COVERS.length)];

  const body: IDataObject = {
    parent: { database_id: "2a02570f-e49f-802b-a67c-fe4c230a5699" },
    properties: {
      "": { title: [{ text: { content: name } }] },
    },
    cover: { type: "external", external: { url: coverUrl } },
  };

  if (parentId) {
    (body.properties as IDataObject)["親タスク"] = {
      relation: [{ id: parentId }],
    };
  }

  if (taskContent) {
    body.children = mdToBlocks(taskContent);
  }

  return [{ json: { requestBody: JSON.stringify(body) } }];
}
