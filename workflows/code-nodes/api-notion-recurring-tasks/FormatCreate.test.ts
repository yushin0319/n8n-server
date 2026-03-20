import { beforeEach, describe, expect, it, vi } from "vitest";
import formatCreate from "./FormatCreate";

describe("FormatCreate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("作成結果をフォーマットする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "page-123", url: "https://notion.so/page-123" },
      }),
    });

    const result = formatCreate() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "create",
      success: true,
      id: "page-123",
      url: "https://notion.so/page-123",
    });
  });

  it("id が undefined でも success=true を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const result = formatCreate() as INodeExecutionData[];
    expect(result[0].json.action).toBe("create");
    expect(result[0].json.success).toBe(true);
  });
});
