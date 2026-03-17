import { mdToBlocks } from "../_shared/notionBlocks";

export default function (): CodeNodeReturn {
  const { pageId, taskContent } = $("PrepReplace").first().json;
  const children = mdToBlocks(taskContent as string);
  const contentBody = JSON.stringify({ children });
  return [{ json: { pageId, contentBody } }];
}
