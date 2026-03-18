import { describe, expect, it } from "vitest";
import { mdToBlocks, parseRichText } from "./notionBlocks";

describe("parseRichText", () => {
  it("プレーンテキストをそのまま返す", () => {
    const result = parseRichText("hello world");
    expect(result).toEqual([
      { type: "text", text: { content: "hello world" } },
    ]);
  });

  it("太字(**text**)をboldアノテーション付きで変換する", () => {
    const result = parseRichText("before **bold** after");
    expect(result).toEqual([
      { type: "text", text: { content: "before " } },
      {
        type: "text",
        text: { content: "bold" },
        annotations: { bold: true },
      },
      { type: "text", text: { content: " after" } },
    ]);
  });

  it("インラインコード(`code`)をcodeアノテーション付きで変換する", () => {
    const result = parseRichText("use `npm install` here");
    expect(result).toEqual([
      { type: "text", text: { content: "use " } },
      {
        type: "text",
        text: { content: "npm install" },
        annotations: { code: true },
      },
      { type: "text", text: { content: " here" } },
    ]);
  });

  it("リンク([text](url))をlink付きで変換する", () => {
    const result = parseRichText("see [Google](https://google.com)");
    expect(result).toEqual([
      { type: "text", text: { content: "see " } },
      {
        type: "text",
        text: { content: "Google", link: { url: "https://google.com" } },
      },
    ]);
  });

  it("複数のインライン記法を混在させて変換する", () => {
    const result = parseRichText("**bold** and `code`");
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("annotations.bold", true);
    expect(result[1]).toEqual({
      type: "text",
      text: { content: " and " },
    });
    expect(result[2]).toHaveProperty("annotations.code", true);
  });

  it("空文字列の場合はプレーンテキストとして返す", () => {
    const result = parseRichText("");
    expect(result).toEqual([{ type: "text", text: { content: "" } }]);
  });
});

describe("mdToBlocks", () => {
  it("見出し2(##)をheading_2ブロックに変換する", () => {
    const blocks = mdToBlocks("## タイトル");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      object: "block",
      type: "heading_2",
    });
    expect((blocks[0].heading_2 as any).rich_text[0].text.content).toBe(
      "タイトル",
    );
  });

  it("見出し3(###)をheading_3ブロックに変換する", () => {
    const blocks = mdToBlocks("### サブタイトル");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      object: "block",
      type: "heading_3",
    });
  });

  it("箇条書き(- )をbulleted_list_itemに変換する", () => {
    const blocks = mdToBlocks("- item1\n- item2");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("bulleted_list_item");
    expect(blocks[1].type).toBe("bulleted_list_item");
  });

  it("番号付きリスト(1. )をnumbered_list_itemに変換する", () => {
    const blocks = mdToBlocks("1. first\n2. second");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("numbered_list_item");
  });

  it("区切り線(---)をdividerに変換する", () => {
    const blocks = mdToBlocks("---");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      object: "block",
      type: "divider",
      divider: {},
    });
  });

  it("空行をスキップする", () => {
    const blocks = mdToBlocks("line1\n\nline2");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("paragraph");
  });

  it("通常テキストをparagraphに変換する", () => {
    const blocks = mdToBlocks("普通のテキスト");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      object: "block",
      type: "paragraph",
    });
  });

  it("混在したMarkdownを正しく変換する", () => {
    const md = "## 概要\n- ポイント1\n- **重要** ポイント\n---\n完了";
    const blocks = mdToBlocks(md);
    expect(blocks).toHaveLength(5);
    expect(blocks[0].type).toBe("heading_2");
    expect(blocks[1].type).toBe("bulleted_list_item");
    expect(blocks[2].type).toBe("bulleted_list_item");
    expect(blocks[3].type).toBe("divider");
    expect(blocks[4].type).toBe("paragraph");
  });

  it("見出し内のインライン記法も変換する", () => {
    const blocks = mdToBlocks("## **太字**見出し");
    const richText = (blocks[0].heading_2 as any).rich_text;
    expect(richText).toHaveLength(2);
    expect(richText[0].annotations.bold).toBe(true);
    expect(richText[1].text.content).toBe("見出し");
  });
});
