import { beforeEach, describe, expect, it, vi } from "vitest";
import prepDeleteFolder from "./PrepDeleteFolder";

describe("gdrive/PrepDeleteFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("folder_idを正しく抽出する", () => {
    vi.stubGlobal("$json", { body: { folder_id: "folder123" } });

    const result = prepDeleteFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.folderId).toBe("folder123");
  });

  it("folder_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepDeleteFolder()).toEqual([
      { json: { _error: true, message: "folder_id is required" } },
    ]);
  });
});
