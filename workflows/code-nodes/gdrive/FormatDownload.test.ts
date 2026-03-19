import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDownload from "./FormatDownload";

describe("gdrive-download/FormatDownload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("BinaryToTextで変換済みのテキストをcontentとして返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { data: "file content here" },
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

  it("日本語テキストを正しく返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { data: "こんにちは世界" },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result[0].json.content).toBe("こんにちは世界");
  });

  it("dataがない場合JSONをstringifyする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { foo: "bar" },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result[0].json.content).toBe('{"foo":"bar"}');
  });
});
