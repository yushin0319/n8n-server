import { beforeEach, describe, expect, it, vi } from "vitest";
import formatList from "./FormatList";

describe("gdrive-list/FormatList", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("ファイル一覧を整形して返す", () => {
    vi.stubGlobal("$json", {
      files: [
        {
          id: "f1",
          name: "doc.txt",
          mimeType: "text/plain",
          size: "1024",
          modifiedTime: "2025-01-01T00:00:00Z",
          webViewLink: "https://example.com/f1",
        },
      ],
      nextPageToken: "next123",
    });

    const result = formatList() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.action).toBe("list");
    expect(result[0].json.count).toBe(1);
    expect(result[0].json.next_page_token).toBe("next123");
    const files = result[0].json.files as IDataObject[];
    expect(files[0].id).toBe("f1");
    expect(files[0].size).toBe(1024);
  });

  it("ファイルがない場合空配列を返す", () => {
    vi.stubGlobal("$json", {});

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.files).toEqual([]);
    expect(result[0].json.next_page_token).toBeNull();
  });
});
