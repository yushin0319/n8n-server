import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDelete from "./FormatDelete";

describe("gdrive-delete/FormatDelete", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("削除成功レスポンスを返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDelete() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "delete",
      success: true,
      file_id: "abc123",
    });
  });
});
