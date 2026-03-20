import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDeleteFolder from "./FormatDeleteFolder";

describe("gdrive/FormatDeleteFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("フォルダ削除成功レスポンスを返す", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { folder_id: "folder123" } }),
    }));

    const result = formatDeleteFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "deleteFolder",
      success: true,
      folder_id: "folder123",
    });
  });
});
