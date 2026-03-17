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
    expect(result[0].json.file_id).toBe("abc123");
  });

  it("file_idがない場合エラーを投げる", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(() => prepInfo()).toThrow("file_id is required");
  });
});
