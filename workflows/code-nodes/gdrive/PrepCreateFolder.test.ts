import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCreateFolder from "./PrepCreateFolder";

describe("gdrive/PrepCreateFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("nameとデフォルトparent_idでフォルダ作成パラメータを返す", () => {
    vi.stubGlobal("$json", { body: { name: "new-folder" } });

    const result = prepCreateFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.name).toBe("new-folder");
    expect(result[0].json.mimeType).toBe("application/vnd.google-apps.folder");
    expect(result[0].json.parents).toEqual(["root"]);
  });

  it("parent_id指定時はそれを使う", () => {
    vi.stubGlobal("$json", {
      body: { name: "sub-folder", parent_id: "parent123" },
    });

    const result = prepCreateFolder() as INodeExecutionData[];
    expect(result[0].json.parents).toEqual(["parent123"]);
  });

  it("nameがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepCreateFolder()).toEqual([
      { json: { _error: true, message: "name is required" } },
    ]);
  });
});
