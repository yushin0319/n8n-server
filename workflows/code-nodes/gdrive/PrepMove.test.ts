import { beforeEach, describe, expect, it, vi } from "vitest";
import prepMove from "./PrepMove";

describe("gdrive-move/PrepMove", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idとfolder_idを抽出する", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", folder_id: "folder456" },
    });

    const result = prepMove() as INodeExecutionData[];
    expect(result).toEqual([
      { json: { fileId: "file123", folderId: "folder456" } },
    ]);
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder456" },
    });

    expect(prepMove()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });

  it("folder_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123" },
    });

    expect(prepMove()).toEqual([
      { json: { _error: true, message: "folder_id is required" } },
    ]);
  });
});
