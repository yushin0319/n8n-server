import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("gdrive/PrepSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("デフォルトパラメータで検索条件を返す", () => {
    vi.stubGlobal("$json", { body: {} });

    const result = prepSearch() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.limit).toBe(50);
  });

  it("query指定時は検索クエリを設定する", () => {
    vi.stubGlobal("$json", { body: { query: "test" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.queryString).toBe("test");
    expect(result[0].json.searchMethod).toBe("name");
  });

  it("folder_id指定時はフォルダフィルタを設定する", () => {
    vi.stubGlobal("$json", { body: { folder_id: "folder123" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.folderId).toBe("folder123");
  });

  it("limit指定時はそれを使う", () => {
    vi.stubGlobal("$json", { body: { limit: 100 } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.limit).toBe(100);
  });

  it("mime_type指定時はフィルタに含める", () => {
    vi.stubGlobal("$json", { body: { mime_type: "application/pdf" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.mimeType).toBe("application/pdf");
  });
});
