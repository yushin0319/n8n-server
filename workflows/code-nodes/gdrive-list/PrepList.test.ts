import { describe, expect, it, vi, beforeEach } from "vitest";
import prepList from "./PrepList";

describe("gdrive-list/PrepList", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("デフォルト値でクエリを構築する", () => {
    vi.stubGlobal("$json", { body: {} });

    const result = prepList() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.q).toBe("'root' in parents and trashed = false");
    expect(result[0].json.pageSize).toBe(20);
    expect(result[0].json.pageToken).toBe("");
  });

  it("指定されたfolder_idでクエリを構築する", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", page_size: 50, page_token: "token1" },
    });

    const result = prepList() as INodeExecutionData[];
    expect(result[0].json.q).toBe(
      "'folder123' in parents and trashed = false",
    );
    expect(result[0].json.pageSize).toBe(50);
    expect(result[0].json.pageToken).toBe("token1");
  });
});
