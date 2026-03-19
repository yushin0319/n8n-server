import { beforeEach, describe, expect, it, vi } from "vitest";
import prepShare from "./PrepShare";

describe("gdrive-share/PrepShare", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idを抽出しデフォルト値を適用する", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      { json: { fileId: "file123", role: "reader", shareType: "anyone" } },
    ]);
  });

  it("roleとtypeを指定できる", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", role: "writer", type: "user" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      { json: { fileId: "file123", role: "writer", shareType: "user" } },
    ]);
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { role: "reader" },
    });

    expect(prepShare()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });
});
