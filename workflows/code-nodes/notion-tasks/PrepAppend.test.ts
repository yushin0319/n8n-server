import { describe, expect, it, vi, beforeEach } from "vitest";
import prepAppend from "./PrepAppend";

describe("PrepAppend", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("contentとpageIdがある場合contentBodyを生成する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { content: "## 見出し\nテキスト" } }),
    }));
    vi.stubGlobal("$json", { id: "page-123", status: "ok" });

    const result = prepAppend() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.hasContent).toBe(true);
    expect(result[0].json.pageId).toBe("page-123");

    const contentBody = JSON.parse(result[0].json.contentBody as string);
    expect(contentBody.children).toHaveLength(2);
    expect(contentBody.children[0].type).toBe("heading_2");
  });

  it("contentがない場合hasContentがfalse", () => {
    vi.stubGlobal("$", () => ({
      first: () => ({ json: { content: null } }),
    }));
    vi.stubGlobal("$json", { id: "page-456" });

    const result = prepAppend() as INodeExecutionData[];
    expect(result[0].json.hasContent).toBe(false);
    expect(result[0].json.contentBody).toBeNull();
  });

  it("pageIdがない場合hasContentがfalse", () => {
    vi.stubGlobal("$", () => ({
      first: () => ({ json: { content: "some content" } }),
    }));
    vi.stubGlobal("$json", {});

    const result = prepAppend() as INodeExecutionData[];
    expect(result[0].json.hasContent).toBe(false);
  });
});
