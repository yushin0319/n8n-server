import { describe, expect, it, vi, beforeEach } from "vitest";
import formatUpdate from "./FormatUpdate";

describe("FormatUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("コンテンツ追加ありで success を返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { hasContent: true, pageId: "page-1" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({ json: { object: "list" } }),
    });

    const result = formatUpdate() as INodeExecutionData[];
    expect(result[0].json.action).toBe("update");
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.id).toBe("page-1");
    expect(result[0].json.hasContent).toBe(true);
    expect(result[0].json.contentAppended).toBe(true);
    expect(result[0].json.url).toBe("https://www.notion.so/page1");
  });

  it("コンテンツなしで success を返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { hasContent: false, pageId: "page-2" } }),
    }));
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const result = formatUpdate() as INodeExecutionData[];
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.hasContent).toBe(false);
    expect(result[0].json.contentAppended).toBe(false);
  });

  it("PrepAppend ノード取得失敗時にエラーをスローする", () => {
    vi.stubGlobal("$", (_name: string) => {
      throw new Error("node not found");
    });
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    expect(() => formatUpdate()).toThrow("PrepAppend取得エラー: node not found");
  });
});
