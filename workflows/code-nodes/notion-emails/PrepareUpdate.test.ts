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

  it("importanceを重要度プロパティに設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", importance: "重要" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-1");
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.重要度.select.name).toBe("重要");
  });

  it("reasonを理由プロパティに設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", reason: "重要な案件のため" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.理由.rich_text[0].text.content).toBe(
      "重要な案件のため",
    );
  });

  it("statusをステータスプロパティに設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", status: "既読" } },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.ステータス.select.name).toBe("既読");
  });

  it("bodyラッパーなしでも動作する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { page_id: "page-1", importance: "通常" },
      }),
    });

    const result = prepareUpdate() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-1");
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.重要度.select.name).toBe("通常");
  });
});
