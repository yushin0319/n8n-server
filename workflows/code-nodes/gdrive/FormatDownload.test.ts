import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDownload from "./FormatDownload";

describe("gdrive-download/FormatDownload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("バイナリデータからcontentを抽出する", () => {
    const base64Content = Buffer.from("file content here").toString("base64");
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "abc123", name: "test.txt" },
        binary: { data: { data: base64Content, mimeType: "text/plain" } },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "download",
      file_id: "abc123",
      content: "file content here",
    });
  });

  it("日本語テキストを正しくデコードする", () => {
    const base64Content = Buffer.from("こんにちは世界").toString("base64");
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "abc123", name: "test.txt" },
        binary: { data: { data: base64Content, mimeType: "text/plain" } },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result[0].json.content).toBe("こんにちは世界");
  });

  it("バイナリがない場合JSONをstringifyする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { foo: "bar" },
        binary: undefined,
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result[0].json.content).toBe('{"foo":"bar"}');
  });
});
