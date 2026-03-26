import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("PrepSearch (notion-tasks)", () => {
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

  it("statusフィルタを適用する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { status: "進行中" } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const filter = JSON.parse(result[0].json.filterJson as string);
    expect(filter.property).toBe("ステータス");
    expect(filter.status.equals).toBe("進行中");
  });

  it("複数フィルタをandで結合する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { status: "完了", query: "テスト" } },
      }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const filter = JSON.parse(result[0].json.filterJson as string);
    expect(filter.and).toHaveLength(2);
  });
});
