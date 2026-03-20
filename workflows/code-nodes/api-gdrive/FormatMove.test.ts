import { beforeEach, describe, expect, it, vi } from "vitest";
import formatMove from "./FormatMove";

describe("gdrive-move/FormatMove", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("移動結果を整形して返す", () => {
    vi.stubGlobal("$json", {
      id: "file123",
      name: "test.txt",
      webViewLink: "https://drive.google.com/file/123",
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { folderId: "folder456" } }),
    }));

    const result = formatMove() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          action: "move",
          success: true,
          id: "file123",
          name: "test.txt",
          url: "https://drive.google.com/file/123",
          folder_id: "folder456",
        },
      },
    ]);
  });
});
