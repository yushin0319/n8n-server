import { beforeEach, describe, expect, it, vi } from "vitest";
import formatCreateFolder from "./FormatCreateFolder";

describe("gdrive/FormatCreateFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("フォルダ作成成功レスポンスを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          id: "folder123",
          name: "new-folder",
          webViewLink: "https://example.com/folder123",
        },
      }),
    });

    const result = formatCreateFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "createFolder",
      success: true,
      id: "folder123",
      name: "new-folder",
      url: "https://example.com/folder123",
    });
  });
});
