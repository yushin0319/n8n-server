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
