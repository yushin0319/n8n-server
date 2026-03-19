import { beforeEach, describe, expect, it, vi } from "vitest";
import formatSearch from "./FormatSearch";

describe("gdrive/FormatSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("検索結果を整形して返す", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "file1",
            name: "doc.txt",
            mimeType: "text/plain",
            size: "1024",
            modifiedTime: "2026-01-01T00:00:00Z",
            webViewLink: "https://drive.google.com/file/file1",
            parents: ["root"],
          },
        },
        {
          json: {
            id: "file2",
            name: "photo.jpg",
            mimeType: "image/jpeg",
            size: "2048",
            modifiedTime: "2026-01-02T00:00:00Z",
            webViewLink: "https://drive.google.com/file/file2",
          },
        },
      ],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.action).toBe("search");
    expect(result[0].json.count).toBe(2);
    const files = result[0].json.files as IDataObject[];
    expect(files[0]).toEqual({
      id: "file1",
      name: "doc.txt",
      type: "text/plain",
      size: 1024,
      modified: "2026-01-01T00:00:00Z",
      url: "https://drive.google.com/file/file1",
      parents: ["root"],
    });
  });

  it("結果が空の場合は空配列を返す", () => {
    vi.stubGlobal("$input", { all: () => [] });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.files).toEqual([]);
  });
});
