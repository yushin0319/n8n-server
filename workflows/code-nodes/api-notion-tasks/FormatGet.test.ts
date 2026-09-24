import { beforeEach, describe, expect, it, vi } from "vitest";
import formatGet from "./FormatGet";

describe("FormatGet", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("ネイティブノード簡略化出力の content フィールドからテキストを抽出する", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-1" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            type: "paragraph",
            content: "Hello World",
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.action).toBe("get");
    expect(result[0].json.page_id).toBe("page-1");
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].text).toBe("Hello World");
  });

  it("rich_text フォールバックでテキストを抽出する", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-1b" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            type: "paragraph",
            paragraph: {
              rich_text: [{ plain_text: "Hello " }, { plain_text: "World" }],
            },
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("Hello World");
  });

  it("child_database を処理する", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-2" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            type: "child_database",
            child_database: { title: "My DB" },
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks[0].text).toBe("[child_database: My DB]");
  });

  it("image と divider を処理する", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-3" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        { json: { type: "image", image: {} } },
        { json: { type: "divider", divider: {} } },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe("[image]");
    expect(blocks[1].text).toBe("---");
  });

  it("テキストが空のブロックをフィルタする", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-4" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            type: "paragraph",
            paragraph: { rich_text: [] },
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(0);
    expect(result[0].json.text_content).toBe("");
  });

  it("table は [table] として残し、table_row のセルを | 区切りで読む", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-table" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "tbl-1",
            type: "table",
            has_children: true,
            table: { table_width: 2 },
          },
        },
        {
          json: {
            id: "row-1",
            type: "table_row",
            parent_id: "tbl-1",
            has_children: false,
            table_row: {
              cells: [
                [{ plain_text: "方法" }],
                [{ plain_text: "費" }, { plain_text: "用" }],
              ],
            },
          },
        },
        {
          json: {
            id: "row-2",
            type: "table_row",
            parent_id: "tbl-1",
            has_children: false,
            table_row: { cells: [[{ plain_text: "VRoid" }], []] },
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.blocks).toEqual([
      { id: "tbl-1", type: "table", text: "[table]", has_children: true },
      {
        id: "row-1",
        type: "table_row",
        text: "方法 | 費用",
        has_children: false,
        parent_id: "tbl-1",
      },
      {
        id: "row-2",
        type: "table_row",
        text: "VRoid | ",
        has_children: false,
        parent_id: "tbl-1",
      },
    ]);
    expect(result[0].json.text_content).toBe("[table]\n方法 | 費用\nVRoid | ");
  });

  it("テキストを持たない未知の種類は捨てずに [type] として残す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-unknown" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "col-1",
            type: "column_list",
            has_children: true,
            column_list: {},
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.blocks).toEqual([
      {
        id: "col-1",
        type: "column_list",
        text: "[column_list]",
        has_children: true,
      },
    ]);
  });

  it("入れ子の子ブロックは parent_id 付きで返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-nested" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "b-1",
            type: "bulleted_list_item",
            parent_id: "page-nested",
            has_children: true,
            bulleted_list_item: { rich_text: [{ plain_text: "親" }] },
          },
        },
        {
          json: {
            id: "b-2",
            type: "bulleted_list_item",
            parent_id: "b-1",
            has_children: false,
            bulleted_list_item: { rich_text: [{ plain_text: "子" }] },
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { parent_id?: string }[];
    expect(blocks[0].parent_id).toBeUndefined();
    expect(blocks[1].parent_id).toBe("b-1");
    expect(result[0].json.text_content).toBe("親\n子");
  });

  it("ブロックの id と has_children を返す（子ページを get で辿れるように）", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-5" } }),
    }));
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "child-page-1",
            type: "child_page",
            has_children: true,
            content: "2025漫才台本",
          },
        },
        {
          json: {
            id: "para-1",
            type: "paragraph",
            has_children: false,
            content: "本文",
          },
        },
      ],
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as {
      id: string;
      type: string;
      text: string;
      has_children: boolean;
    }[];
    expect(blocks).toEqual([
      {
        id: "child-page-1",
        type: "child_page",
        text: "2025漫才台本",
        has_children: true,
      },
      { id: "para-1", type: "paragraph", text: "本文", has_children: false },
    ]);
    expect(result[0].json.text_content).toBe("2025漫才台本\n本文");
  });

  it("本文が空のページ（GetBlocks の alwaysOutputData による空アイテム）は blocks が空になる", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "page-empty" } }),
    }));
    vi.stubGlobal("$input", { all: () => [{ json: {} }] });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.page_id).toBe("page-empty");
    expect(result[0].json.blocks).toEqual([]);
    expect(result[0].json.text_content).toBe("");
  });

  it("PrepGet ノードから pageId を取得する", () => {
    vi.stubGlobal("$", (name: string) => {
      if (name === "PrepGet") {
        return { first: () => ({ json: { pageId: "page-from-prep" } }) };
      }
      throw new Error(`node ${name} not executed`);
    });
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.page_id).toBe("page-from-prep");
  });

  it("ExtractPageId ノードから pageId を取得する (task_id 経由)", () => {
    vi.stubGlobal("$", (name: string) => {
      if (name === "PrepGet") {
        throw new Error("PrepGet not executed");
      }
      if (name === "ExtractPageId") {
        return {
          first: () => ({ json: { pageId: "page-from-extract" } }),
        };
      }
      throw new Error(`unexpected node ${name}`);
    });
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.page_id).toBe("page-from-extract");
  });

  it("両方のノードから pageId が取得できない場合エラーをスロー", () => {
    vi.stubGlobal("$", (_name: string) => {
      throw new Error("node not executed");
    });
    vi.stubGlobal("$input", { all: () => [] });

    expect(() => formatGet()).toThrow(
      "FormatGet: pageId が PrepGet / ExtractPageId のどちらからも取得できません",
    );
  });
});
