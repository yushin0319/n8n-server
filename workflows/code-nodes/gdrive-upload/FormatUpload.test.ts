import { describe, expect, it, vi, beforeEach } from "vitest";
import formatUpload from "./FormatUpload";

describe("gdrive-upload/FormatUpload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("アップロード結果を整形して返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "file123", name: "uploaded.txt" },
      }),
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: {
          fileId: "file123",
          name: "uploaded.txt",
          webViewLink: "https://drive.google.com/file/123",
        },
      }),
    }));

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

  it("UpdateContentの応答にidがない場合PrepContentのfileIdを使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: {
          fileId: "fallback123",
          name: "fallback.txt",
          webViewLink: "https://drive.google.com/file/fallback",
        },
      }),
    }));

    const result = formatUpload() as INodeExecutionData[];
    expect(result[0].json.id).toBe("fallback123");
    expect(result[0].json.name).toBe("fallback.txt");
  });
});
