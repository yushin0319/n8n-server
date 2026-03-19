import { beforeEach, describe, expect, it, vi } from "vitest";
import formatUpload from "./FormatUpload";

describe("gdrive-upload/FormatUpload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("アップロード結果を整形して返す", () => {
    // ネイティブUploadノードの出力（id, name, webViewLink）
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          id: "file123",
          name: "uploaded.txt",
          webViewLink: "https://drive.google.com/file/123",
        },
      }),
    });

    const result = formatUpload() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          action: "upload",
          success: true,
          id: "file123",
          name: "uploaded.txt",
          url: "https://drive.google.com/file/123",
        },
      },
    ]);
  });
});
