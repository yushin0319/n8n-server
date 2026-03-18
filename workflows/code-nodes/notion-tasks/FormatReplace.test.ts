import { describe, expect, it, vi, beforeEach } from "vitest";
import formatReplace from "./FormatReplace";

describe("FormatReplace", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("success=true と正しい pageId を返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "abc-def-123" } }),
    }));

    const result = formatReplace() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.action).toBe("replace");
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.id).toBe("abc-def-123");
  });

  it("url にダッシュが含まれない", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { pageId: "abc-def-123" } }),
    }));

    const result = formatReplace() as INodeExecutionData[];
    const url = result[0].json.url as string;
    expect(url).toBe("https://www.notion.so/abcdef123");
    expect(url).not.toContain("-");
  });
});
