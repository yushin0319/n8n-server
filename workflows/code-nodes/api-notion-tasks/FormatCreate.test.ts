import { beforeEach, describe, expect, it, vi } from "vitest";
import formatCreate from "./FormatCreate";

describe("FormatCreate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("id がある場合 success=true を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "page-123", url: "https://notion.so/page-123" },
      }),
    });

    const result = formatCreate() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.action).toBe("create");
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.id).toBe("page-123");
  });

  it("id がない場合 success=false を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const result = formatCreate() as INodeExecutionData[];
    expect(result[0].json.success).toBe(false);
    expect(result[0].json.id).toBeNull();
  });

  it("url を含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "page-456", url: "https://notion.so/page-456" },
      }),
    });

    const result = formatCreate() as INodeExecutionData[];
    expect(result[0].json.url).toBe("https://notion.so/page-456");
  });
});
