import { beforeEach, describe, expect, it, vi } from "vitest";
import prepShareFolder from "./PrepShareFolder";

describe("gdrive/PrepShareFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("folder_idとデフォルトのrole/typeを抽出する", () => {
    vi.stubGlobal("$json", { body: { folder_id: "folder123" } });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.folderId).toBe("folder123");
    expect(result[0].json.role).toBe("reader");
    expect(result[0].json.shareType).toBe("anyone");
  });

  it("role, type指定時はそれを使う", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", role: "writer", type: "user" },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result[0].json.role).toBe("writer");
    expect(result[0].json.shareType).toBe("user");
  });

  it("folder_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepShareFolder()).toEqual([
      { json: { _error: true, message: "folder_id is required" } },
    ]);
  });
});
