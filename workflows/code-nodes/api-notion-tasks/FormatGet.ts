export default function (): CodeNodeReturn {
  // PrepGet (page_id 直渡し) または ExtractPageId (task_id 経由解決) から pageId を取得
  let pageId = "";
  try {
    pageId = $("PrepGet").first().json.pageId as string;
  } catch (_) {
    // PrepGet が実行されなかったパス
  }
  if (!pageId) {
    try {
      pageId = $("ExtractPageId").first().json.pageId as string;
    } catch (_) {
      // ExtractPageId も無い
    }
  }
  if (!pageId) {
    throw new Error(
      "FormatGet: pageId が PrepGet / ExtractPageId のどちらからも取得できません",
    );
  }
  const blocks = $input
    .all()
    .map((item) => {
      const block = item.json as IDataObject;
      const bType = block.type as string;
      let text = "";
      if (block.content != null) {
        // ネイティブノード簡略化出力: content フィールドにテキストが入る
        text = String(block.content);
      } else if ((block[bType] as IDataObject)?.rich_text) {
        // HTTP Request 生出力: block[type].rich_text 配列
        text = ((block[bType] as IDataObject).rich_text as IDataObject[])
          .map((t: IDataObject) => t.plain_text)
          .join("");
      } else if (bType === "child_database") {
        text =
          "[child_database: " +
          ((block.child_database as IDataObject)?.title || "") +
          "]";
      } else if (bType === "image") {
        text = "[image]";
      } else if (bType === "divider") {
        text = "---";
      }
      return { type: bType, text };
    })
    .filter((b: { type: string; text: string }) => b.text);
  const textLines = blocks
    .map((b: { type: string; text: string }) => b.text)
    .join("\n");
  return [
    {
      json: {
        action: "get",
        page_id: pageId,
        blocks,
        text_content: textLines,
      },
    },
  ];
}
