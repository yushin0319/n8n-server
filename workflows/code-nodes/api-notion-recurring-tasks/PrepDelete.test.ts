import { beforeEach, describe, expect, it, vi } from "vitest";
import prepDelete from "./PrepDelete";

describe("PrepDelete", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("page_id を pageId として返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { page_id: "abc-123" } } }),
    });

    const result = prepDelete() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("abc-123");
  });

  it("page_id がない場合エラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    expect(() => prepDelete()).toThrow("body.page_id は必須です");
  });

  it("body が undefined の場合エラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    expect(() => prepDelete()).toThrow("body.page_id は必須です");
  });
});
