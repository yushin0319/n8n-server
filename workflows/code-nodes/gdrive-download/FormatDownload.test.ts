import { describe, expect, it, vi, beforeEach } from "vitest";
import formatDownload from "./FormatDownload";

describe("gdrive-download/FormatDownload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("data付きレスポンスからcontentを抽出する", () => {
    vi.stubGlobal("$json", { data: "file content here" });
    vi.stubGlobal("$", (name: string) => ({
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

  it("dataがない場合JSONをstringifyする", () => {
    vi.stubGlobal("$json", { foo: "bar" });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { file_id: "abc123" } }),
    }));

    const result = formatDownload() as INodeExecutionData[];
    expect(result[0].json.content).toBe('{"foo":"bar"}');
  });
});
