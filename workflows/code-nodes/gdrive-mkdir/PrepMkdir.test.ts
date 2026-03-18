import { describe, expect, it, vi, beforeEach } from "vitest";
import prepMkdir from "./PrepMkdir";

describe("gdrive-mkdir/PrepMkdir", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("nameとデフォルトparent_idでフォルダ作成パラメータを返す", () => {
    vi.stubGlobal("$json", { body: { name: "new-folder" } });

    const result = prepMkdir() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.name).toBe("new-folder");
    expect(result[0].json.mimeType).toBe(
      "application/vnd.google-apps.folder",
    );
    expect(result[0].json.parents).toEqual(["root"]);
  });

  it("parent_id指定時はそれを使う", () => {
    vi.stubGlobal("$json", {
      body: { name: "sub-folder", parent_id: "parent123" },
    });

    const result = prepMkdir() as INodeExecutionData[];
    expect(result[0].json.parents).toEqual(["parent123"]);
  });

  it("nameがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepMkdir()).toEqual([{ json: { _error: true, message: "name is required" } }]);
  });
});
