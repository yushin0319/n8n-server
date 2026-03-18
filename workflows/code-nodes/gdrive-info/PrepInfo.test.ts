import { describe, expect, it, vi, beforeEach } from "vitest";
import prepInfo from "./PrepInfo";

describe("gdrive-info/PrepInfo", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idを正しく抽出する", () => {
    vi.stubGlobal("$json", { body: { file_id: "abc123" } });

    const result = prepInfo() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.fileId).toBe("abc123");
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepInfo()).toEqual([{ json: { _error: true, message: "file_id is required" } }]);
  });
});
