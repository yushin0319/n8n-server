/**
 * Notion ブロック構築ユーティリティ.
 * Markdown テキストを Notion API のブロック/リッチテキスト形式に変換する。
 */

/** Markdown インライン記法をNotionリッチテキストセグメントに変換する */
export function parseRichText(
  text: string,
): IDataObject[] {
  const segments: IDataObject[] = [];
  const re = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({
        type: "text",
        text: { content: text.slice(last, m.index) },
      });
    }
    if (m[2]) {
      segments.push({
        type: "text",
        text: { content: m[2] },
        annotations: { bold: true },
      });
    } else if (m[3]) {
      segments.push({
        type: "text",
        text: { content: m[3] },
        annotations: { code: true },
      });
    } else if (m[4] && m[5]) {
      segments.push({
        type: "text",
        text: { content: m[4], link: { url: m[5] } },
      });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({
      type: "text",
      text: { content: text.slice(last) },
    });
  }
  return segments.length
    ? segments
    : [{ type: "text", text: { content: text } }];
}

/** Markdown テキストを Notion ブロック配列に変換する */
export function mdToBlocks(taskContent: string): IDataObject[] {
  const lines = taskContent.split("\n");
  const blocks: IDataObject[] = [];
  for (const line of lines) {
    if (line.match(/^## /)) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: parseRichText(line.slice(3)) },
      });
    } else if (line.match(/^### /)) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: parseRichText(line.slice(4)) },
      });
    } else if (line.match(/^- /)) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseRichText(line.slice(2)) },
      });
    } else if (line.match(/^\d+\. /)) {
      blocks.push({
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: parseRichText(line.replace(/^\d+\. /, "")),
        },
      });
    } else if (line.match(/^---$/)) {
      blocks.push({ object: "block", type: "divider", divider: {} });
    } else if (line.trim() === "") {
      continue;
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: parseRichText(line) },
      });
    }
  }
  return blocks;
}
