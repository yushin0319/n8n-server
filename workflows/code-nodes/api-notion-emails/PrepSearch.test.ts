import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("PrepSearch (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("フィルタなしの場合filterJsonが空文字を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.filterJson).toBe("");
  });

  it("importanceフィルタを適用する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { importance: "重要" } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const filter = JSON.parse(result[0].json.filterJson as string);
    expect(filter.property).toBe("重要度");
  });

  it("limitを100以下に制限する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { limit: 200 } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    expect(result[0].json.limit).toBe(100);
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
    const filter = JSON.parse(result[0].json.filterJson as string);
    expect(filter.and).toHaveLength(3);
  });
});
