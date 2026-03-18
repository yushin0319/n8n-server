import { beforeEach, describe, expect, it, vi } from "vitest";
import formatSearch from "./FormatSearch";

describe("gdrive-search/FormatSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("検索結果を整形して返す", () => {
    vi.stubGlobal("$json", {
      files: [
        {
          id: "file1",
          name: "test.txt",
          mimeType: "text/plain",
          size: "1024",
          modifiedTime: "2025-01-01T00:00:00Z",
          webViewLink: "https://drive.google.com/file/1",
          parents: ["root"],
        },
      ],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.action).toBe("search");
    expect(result[0].json.count).toBe(1);
    expect(result[0].json.files[0]).toEqual({
      id: "file1",
      name: "test.txt",
      type: "text/plain",
      size: 1024,
      modified: "2025-01-01T00:00:00Z",
      url: "https://drive.google.com/file/1",
      parents: ["root"],
    });
  });

  it("ファイルが空の場合はcount 0を返す", () => {
    vi.stubGlobal("$json", { files: [] });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.files).toEqual([]);
  });

  it("filesがundefinedの場合も空配列を返す", () => {
    vi.stubGlobal("$json", {});

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.files).toEqual([]);
  });
});
