import { describe, expect, it, vi, beforeEach } from "vitest";
import formatGet from "./FormatGet";

describe("FormatGet", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("paragraph ブロックから rich_text を抽出する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { pageId: "page-1" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [
            {
              type: "paragraph",
              paragraph: {
                rich_text: [{ plain_text: "Hello " }, { plain_text: "World" }],
              },
            },
          ],
        },
      }),
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.action).toBe("get");
    expect(result[0].json.page_id).toBe("page-1");
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].text).toBe("Hello World");
  });

  it("child_database を処理する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { pageId: "page-2" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [
            {
              type: "child_database",
              child_database: { title: "My DB" },
            },
          ],
        },
      }),
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks[0].text).toBe("[child_database: My DB]");
  });

  it("image と divider を処理する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { pageId: "page-3" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [
            { type: "image", image: {} },
            { type: "divider", divider: {} },
          ],
        },
      }),
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe("[image]");
    expect(blocks[1].text).toBe("---");
  });

  it("テキストが空のブロックをフィルタする", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { pageId: "page-4" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [
            {
              type: "paragraph",
              paragraph: { rich_text: [] },
            },
          ],
        },
      }),
    });

    const result = formatGet() as INodeExecutionData[];
    const blocks = result[0].json.blocks as { type: string; text: string }[];
    expect(blocks).toHaveLength(0);
    expect(result[0].json.text_content).toBe("");
  });

  it("PrepGet ノードから pageId を取得する", () => {
    vi.stubGlobal("$", (name: string) => {
      expect(name).toBe("PrepGet");
      return { first: () => ({ json: { pageId: "page-from-prep" } }) };
    });
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: [] } }),
    });

    const result = formatGet() as INodeExecutionData[];
    expect(result[0].json.page_id).toBe("page-from-prep");
  });
});
