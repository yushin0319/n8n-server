import { beforeEach, describe, expect, it, vi } from "vitest";
import prepReplace from "./PrepReplace";

describe("PrepReplace", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("pageId と content を抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { page_id: "page-1", content: "新しい内容" },
        },
      }),
    });

    const result = prepReplace() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.pageId).toBe("page-1");
    expect(result[0].json.taskContent).toBe("新しい内容");
  });

  it("page_id がない場合エラーをスローする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { content: "内容あり" } },
      }),
    });

    expect(() => prepReplace()).toThrow(
      "page_id is required for replace action",
    );
  });

  it("content がない場合エラーをスローする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1" } },
      }),
    });

    expect(() => prepReplace()).toThrow(
      "content is required for replace action",
    );
  });
});
