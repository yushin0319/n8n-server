import { beforeEach, describe, expect, it, vi } from "vitest";
import formatUpdate from "./FormatUpdate";

describe("FormatUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("更新結果をフォーマットする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "page-789", url: "https://notion.so/page-789" },
      }),
    });

    const result = formatUpdate() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "update",
      success: true,
      id: "page-789",
      url: "https://notion.so/page-789",
    });
  });
});
