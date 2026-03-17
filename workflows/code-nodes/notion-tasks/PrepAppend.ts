import { mdToBlocks } from "../_shared/notionBlocks";

export default function (): CodeNodeReturn {
  const taskContent = $("PrepUpdate").first().json.content as string;
  const pageId = $json.id as string;
  const hasContent = !!(taskContent && pageId);

  let contentBody: string | null = null;
  if (hasContent) {
    const children = mdToBlocks(taskContent);
    contentBody = JSON.stringify({ children });
  }

  return [{ json: { ...$json, pageId, hasContent, contentBody } }];
}
