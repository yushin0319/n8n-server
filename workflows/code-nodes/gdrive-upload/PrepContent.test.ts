import { beforeEach, describe, expect, it, vi } from "vitest";
import prepContent from "./PrepContent";

describe("gdrive-upload/PrepContent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("テキストコンテンツからバイナリデータを構築する", () => {
    // PrepUploadの出力が直接$jsonに入る（CreateEmpty廃止）
    vi.stubGlobal("$json", {
      name: "test.txt",
      fileContent: "Hello World",
      folderId: "root",
      mimeType: "text/plain",
      encoding: "utf-8",
    });

    const result = prepContent() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.name).toBe("test.txt");
    expect(result[0].json.folderId).toBe("root");
    expect(result[0].json.mimeType).toBe("text/plain");
    expect(result[0].binary?.file).toBeDefined();
    expect(result[0].binary?.file.mimeType).toBe("text/plain");
    expect(result[0].binary?.file.fileName).toBe("test.txt");
    expect(result[0].binary?.file.data).toBe(
      Buffer.from("Hello World").toString("base64"),
    );
  });

  it("base64エンコーディングのコンテンツを処理する", () => {
    const originalContent = Buffer.from("binary data").toString("base64");
    vi.stubGlobal("$json", {
      name: "data.bin",
      fileContent: originalContent,
      folderId: "root",
      mimeType: "application/octet-stream",
      encoding: "base64",
    });

    const result = prepContent() as INodeExecutionData[];
    expect(result[0].binary?.file.data).toBe(
      Buffer.from(originalContent, "base64").toString("base64"),
    );
  });

  it("5MBを超えるコンテンツはエラーを投げる", () => {
    const largeContent = "x".repeat(6 * 1024 * 1024);
    vi.stubGlobal("$json", {
      name: "large.txt",
      fileContent: largeContent,
      folderId: "root",
      mimeType: "text/plain",
      encoding: "utf-8",
    });

    expect(() => prepContent()).toThrow("Content too large");
  });
});
