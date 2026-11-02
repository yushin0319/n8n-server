import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareUpdate from "./PrepareUpdate";

describe("PrepareUpdate (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("page_idが未指定の場合エラーをスローする", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { importance: "重要" } } }),
    });

    expect(() => prepareUpdate()).toThrow("page_id is required");
  });

  it("importanceを個別フィールドとして返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", importance: "重要" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-1");
    expect(result[0].json.importance).toBe("重要");
  });

  it("reasonを個別フィールドとして返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", reason: "重要な案件のため" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.reason).toBe("重要な案件のため");
  });

  it("statusをemailStatusフィールドとして返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", status: "既読" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.emailStatus).toBe("既読");
  });

  it("bodyラッパーなしでも動作する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { page_id: "page-1", importance: "確認" },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-1");
    expect(result[0].json.importance).toBe("確認");
  });

  it("importance と status は前後の空白を削る", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { page_id: "p", importance: " 重要 ", status: "既読  " },
        },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.importance).toBe("重要");
    expect(result[0].json.emailStatus).toBe("既読");
  });

  it("選択肢に無い importance・status はエラーにする (Notion が新しい選択肢を作るため)", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { page_id: "p", importance: "要確認" } } }),
    });
    expect(() => prepareUpdate()).toThrow("importance");

    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { page_id: "p", status: "確認" } } }),
    });
    expect(() => prepareUpdate()).toThrow("status");
  });
});
