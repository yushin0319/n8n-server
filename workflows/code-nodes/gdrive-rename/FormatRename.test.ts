import { describe, expect, it, vi, beforeEach } from "vitest";
import formatRename from "./FormatRename";

describe("gdrive-rename/FormatRename", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("リネーム結果を整形して返す", () => {
    vi.stubGlobal("$json", {
      id: "file123",
      name: "renamed.txt",
      webViewLink: "https://drive.google.com/file/123",
    });

    const result = formatRename() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          action: "rename",
          success: true,
          id: "file123",
          name: "renamed.txt",
          url: "https://drive.google.com/file/123",
        },
      },
    ]);
  });
});
