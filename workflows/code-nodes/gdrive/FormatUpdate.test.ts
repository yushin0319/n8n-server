import { beforeEach, describe, expect, it, vi } from "vitest";
import formatUpdate from "./FormatUpdate";

describe("gdrive/FormatUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("更新結果を整形して返す", () => {
    vi.stubGlobal("$json", {
      id: "file123",
      name: "renamed.txt",
      webViewLink: "https://drive.google.com/file/123",
    });

    const result = formatUpdate() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          action: "update",
          success: true,
          id: "file123",
          name: "renamed.txt",
          url: "https://drive.google.com/file/123",
        },
      },
    ]);
  });
});
