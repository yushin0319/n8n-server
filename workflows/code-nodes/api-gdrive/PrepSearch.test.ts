import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("gdrive/PrepSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("デフォルトパラメータでtrashed=falseのみのクエリを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    const result = prepSearch() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.queryString).toBe("trashed = false");
    expect(result[0].json.limit).toBe(50);
  });

  it("query指定時はname containsクエリを生成する", () => {
    vi.stubGlobal("$json", { body: { query: "test" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.queryString).toBe(
      "name contains 'test' and trashed = false",
    );
    expect(result[0].json.searchMethod).toBe("query");
  });

  it("folder_id指定時はin parentsクエリを生成する", () => {
    vi.stubGlobal("$json", { body: { folder_id: "folder123" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.queryString).toContain("'folder123' in parents");
  });

  it("mime_type指定時はmimeTypeクエリに含める", () => {
    vi.stubGlobal("$json", { body: { mime_type: "application/pdf" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.queryString).toContain(
      "mimeType = 'application/pdf'",
    );
  });

  it("複数条件を組み合わせる", () => {
    vi.stubGlobal("$json", {
      body: { query: "doc", folder_id: "f1", mime_type: "text/plain" },
    });

    const result = prepSearch() as INodeExecutionData[];
    const q = result[0].json.queryString as string;
    expect(q).toContain("name contains 'doc'");
    expect(q).toContain("'f1' in parents");
    expect(q).toContain("mimeType = 'text/plain'");
    expect(q).toContain("trashed = false");
  });

  it("limit指定時はそれを使う", () => {
    vi.stubGlobal("$json", { body: { limit: 100 } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.limit).toBe(100);
  });
});
