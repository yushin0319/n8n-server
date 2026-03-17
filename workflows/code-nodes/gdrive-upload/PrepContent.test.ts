import { describe, expect, it, vi, beforeEach } from "vitest";
import prepContent from "./PrepContent";

describe("gdrive-upload/PrepContent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("テキストコンテンツからバイナリデータを構築する", () => {
    vi.stubGlobal("$json", {
      id: "file123",
      name: "test.txt",
      webViewLink: "https://drive.google.com/file/123",
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: {
          fileContent: "Hello World",
          mimeType: "text/plain",
          encoding: "utf-8",
        },
      }),
    }));

    const result = prepContent() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.fileId).toBe("file123");
    expect(result[0].json.name).toBe("test.txt");
    expect(result[0].json.mimeType).toBe("text/plain");
    expect(result[0].binary?.file).toBeDefined();
    expect(result[0].binary?.file.mimeType).toBe("text/plain");
    expect(result[0].binary?.file.fileName).toBe("test.txt");
    // base64 of "Hello World"
    expect(result[0].binary?.file.data).toBe(
      Buffer.from("Hello World").toString("base64"),
    );
  });

  it("base64エンコーディングのコンテンツを処理する", () => {
    const originalContent = Buffer.from("binary data").toString("base64");
    vi.stubGlobal("$json", {
      id: "file456",
      name: "data.bin",
      webViewLink: "https://drive.google.com/file/456",
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: {
          fileContent: originalContent,
          mimeType: "application/octet-stream",
          encoding: "base64",
        },
      }),
    }));

    const result = prepContent() as INodeExecutionData[];
    expect(result[0].binary?.file.data).toBe(
      Buffer.from(originalContent, "base64").toString("base64"),
    );
  });

  it("5MBを超えるコンテンツはエラーを投げる", () => {
    const largeContent = "x".repeat(6 * 1024 * 1024);
    vi.stubGlobal("$json", {
      id: "file789",
      name: "large.txt",
      webViewLink: "https://drive.google.com/file/789",
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: {
          fileContent: largeContent,
          mimeType: "text/plain",
          encoding: "utf-8",
        },
      }),
    }));

    expect(() => prepContent()).toThrow("Content too large");
  });
});
