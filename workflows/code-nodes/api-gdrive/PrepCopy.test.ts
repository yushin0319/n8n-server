import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCopy from "./PrepCopy";

describe("gdrive/PrepCopy", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idを必須パラメータとして抽出する", () => {
    vi.stubGlobal("$json", { body: { file_id: "abc123" } });

    const result = prepCopy() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.fileId).toBe("abc123");
    expect(result[0].json.sameFolder).toBe(true);
  });

  it("name, folder_id指定時はsameFolder=falseにする", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "abc123", name: "copy.txt", folder_id: "folder456" },
    });

    const result = prepCopy() as INodeExecutionData[];
    expect(result[0].json.fileId).toBe("abc123");
    expect(result[0].json.name).toBe("copy.txt");
    expect(result[0].json.folderId).toBe("folder456");
    expect(result[0].json.sameFolder).toBe(false);
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepCopy()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });
});
