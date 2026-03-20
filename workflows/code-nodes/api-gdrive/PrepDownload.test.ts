import { beforeEach, describe, expect, it, vi } from "vitest";
import prepDownload from "./PrepDownload";

describe("gdrive-download/PrepDownload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idを正しく抽出する", () => {
    vi.stubGlobal("$json", { body: { file_id: "abc123" } });

    const result = prepDownload() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.fileId).toBe("abc123");
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepDownload()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });
});
