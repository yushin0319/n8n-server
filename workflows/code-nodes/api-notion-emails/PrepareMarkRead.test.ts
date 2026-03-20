import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareMarkRead from "./PrepareMarkRead";

describe("PrepareMarkRead (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("各ページIDに対してステータス=既読の更新ボディを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { allPageIds: ["page-1"] } }),
    });

    const result = prepareMarkRead() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.pageId).toBe("page-1");
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.ステータス.select.name).toBe("既読");
  });

  it("IDが空の場合、空配列を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { allPageIds: [] } }),
    });

    const result = prepareMarkRead() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });

  it("複数IDに対して複数アイテムを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { allPageIds: ["page-1", "page-2", "page-3"] },
      }),
    });

    const result = prepareMarkRead() as INodeExecutionData[];
    expect(result).toHaveLength(3);
    expect(result[0].json.pageId).toBe("page-1");
    expect(result[1].json.pageId).toBe("page-2");
    expect(result[2].json.pageId).toBe("page-3");
  });
});
