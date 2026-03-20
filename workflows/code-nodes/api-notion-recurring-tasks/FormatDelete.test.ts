import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDelete from "./FormatDelete";

describe("FormatDelete", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("削除結果をフォーマットする", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { id: "page-456" } }),
    });

    const result = formatDelete() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "delete",
      success: true,
      id: "page-456",
    });
  });
});
