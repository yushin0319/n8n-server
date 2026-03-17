import { describe, expect, it, vi, beforeEach } from "vitest";
import formatUpdate from "./FormatUpdate";

describe("FormatUpdate (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("success: trueとpage_idを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { id: "page-123", other: "data" } }),
    });

    const result = formatUpdate() as INodeExecutionData[];
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.page_id).toBe("page-123");
  });
});
