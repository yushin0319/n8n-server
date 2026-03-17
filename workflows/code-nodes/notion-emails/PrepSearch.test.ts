import { describe, expect, it, vi, beforeEach } from "vitest";
import prepSearch from "./PrepSearch";

describe("PrepSearch (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("フィルタなしの場合ソートのみ含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter).toBeUndefined();
    expect(body.sorts[0].property).toBe("日時");
  });

  it("importanceフィルタを適用する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { importance: "重要" } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter.property).toBe("重要度");
  });

  it("limitを100以下に制限する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { limit: 200 } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.page_size).toBe(100);
  });

  it("複数フィルタをandで結合する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            importance: "重要",
            status: "未読",
            from: "test@example.com",
          },
        },
      }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter.and).toHaveLength(3);
  });
});
