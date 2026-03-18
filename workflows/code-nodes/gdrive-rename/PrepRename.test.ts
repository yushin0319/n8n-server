import { beforeEach, describe, expect, it, vi } from "vitest";
import prepRename from "./PrepRename";

describe("gdrive-rename/PrepRename", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idとnameを抽出する", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", name: "new-name.txt" },
    });

    const result = prepRename() as INodeExecutionData[];
    expect(result).toEqual([
      { json: { fileId: "file123", name: "new-name.txt" } },
    ]);
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { name: "new-name.txt" },
    });

    expect(prepRename()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });

  it("nameがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123" },
    });

    expect(prepRename()).toEqual([
      { json: { _error: true, message: "name is required" } },
    ]);
  });
});
