export default function (): CodeNodeReturn {
  // PrepGet (page_id 直渡し) または ExtractPageId (task_id 経由解決) から pageId を取得
  let pageId = "";
  let lastErr: unknown = null;
  try {
    pageId = $("PrepGet").first().json.pageId as string;
  } catch (e) {
    lastErr = e;
  }
  if (!pageId) {
    try {
      pageId = $("ExtractPageId").first().json.pageId as string;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!pageId) {
    const errMsg = (lastErr as Error)?.message ?? "unknown";
    throw new Error(
      `FormatGet: pageId が PrepGet / ExtractPageId のどちらからも取得できません (${errMsg})`,
    );
  }
  const plain = (rich: IDataObject[]) =>
    rich.map((t: IDataObject) => t.plain_text).join("");
  const blocks = $input
    .all()
    .map((item) => {
      const block = item.json as IDataObject;
      const bType = block.type as string;
      const body = block[bType] as IDataObject | undefined;
      let text = "";
      if (block.content != null) {
        // ネイティブノード簡略化出力: content フィールドにテキストが入る
        text = String(block.content);
      } else if (body?.rich_text) {
        // HTTP Request 生出力: block[type].rich_text 配列
        text = plain(body.rich_text as IDataObject[]);
      } else if (bType === "table_row" && body?.cells) {
        // 表の行: セルごとに rich_text 配列を持つ
        text = (body.cells as IDataObject[][]).map(plain).join(" | ");
      } else if (bType === "child_database") {
        text = `[child_database: ${body?.title || ""}]`;
      } else if (bType === "divider") {
        text = "---";
      } else if (bType && !body?.rich_text && body !== undefined) {
        // table / image / column_list 等の文字を持たない種類は捨てずに種類名を残す
        // （捨てると「見出しの下が空」に見えて本文の存在に気付けない）
        text = `[${bType}]`;
      }
      // id / has_children も返す: child_page の id を get に渡せば子ページ本文も読める
      // parent_id: Notion ノードはページ直下のブロックにも parent_id=ページID を付けるので、
      // 入れ子（fetchNestedBlocks で取った子ブロック）のときだけ返す
      const parentId = block.parent_id as string | undefined;
      return {
        id: block.id as string,
        type: bType,
        text,
        has_children: block.has_children as boolean,
        ...(parentId && parentId !== pageId ? { parent_id: parentId } : {}),
      };
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
