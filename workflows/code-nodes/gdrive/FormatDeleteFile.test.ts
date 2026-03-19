import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDeleteFile from "./FormatDeleteFile";

describe("gdrive/FormatDeleteFile", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("削除成功レスポンスを返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDeleteFile() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "deleteFile",
      success: true,
      file_id: "abc123",
    });
  });
});
