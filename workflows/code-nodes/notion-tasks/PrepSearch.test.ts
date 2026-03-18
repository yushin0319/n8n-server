import { beforeEach, describe, expect, it, vi } from "vitest";
import prepSearch from "./PrepSearch";

describe("PrepSearch (notion-tasks)", () => {
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
    expect(body.sorts).toHaveLength(1);
    expect(body.sorts[0].property).toBe("最終更新日時");
  });

  it("statusフィルタを適用する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { status: "進行中" } } }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter.property).toBe("ステータス");
    expect(body.filter.status.equals).toBe("進行中");
  });

  it("複数フィルタをandで結合する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { status: "完了", query: "テスト" } },
      }),
    });

    const result = prepSearch() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter.and).toHaveLength(2);
  });
});
