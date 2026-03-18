import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("gdrive-search/PrepSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("パラメータなしでデフォルトクエリを構築する", () => {
    vi.stubGlobal("$json", { body: {} });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.q).toBe("trashed = false");
    expect(result[0].json.pageSize).toBe(20);
    expect(result[0].json.fields).toContain("files(");
  });

  it("queryを指定するとname containsを追加する", () => {
    vi.stubGlobal("$json", { body: { query: "report" } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.q).toContain("name contains 'report'");
  });

  it("mime_typeを指定するとmimeType条件を追加する", () => {
    vi.stubGlobal("$json", {
      body: { mime_type: "application/pdf" },
    });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.q).toContain("mimeType = 'application/pdf'");
  });

  it("page_sizeを指定するとpageSizeに反映する", () => {
    vi.stubGlobal("$json", { body: { page_size: 50 } });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.pageSize).toBe(50);
  });

  it("queryとmime_typeの両方を指定できる", () => {
    vi.stubGlobal("$json", {
      body: { query: "test", mime_type: "text/plain" },
    });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.q).toBe(
      "trashed = false and name contains 'test' and mimeType = 'text/plain'",
    );
  });
});
