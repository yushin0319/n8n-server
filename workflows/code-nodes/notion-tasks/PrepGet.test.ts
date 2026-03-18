import { beforeEach, describe, expect, it, vi } from "vitest";
import prepGet from "./PrepGet";

describe("PrepGet", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("body から pageId を抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-from-body" } },
      }),
    });

    const result = prepGet() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.pageId).toBe("page-from-body");
  });

  it("直接入力から pageId を抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { page_id: "page-direct" },
      }),
    });

    const result = prepGet() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-direct");
  });

  it("page_id がない場合エラーをスローする", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    expect(() => prepGet()).toThrow("page_id is required for get action");
  });
});
