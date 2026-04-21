import { beforeEach, describe, expect, it, vi } from "vitest";
import prepUpdate from "./PrepUpdate";

describe("PrepUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("page_id がない場合エラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { name: "テスト" } } }),
    });

    expect(() => prepUpdate()).toThrow("body.page_id は必須です");
  });

  it("name のみ更新する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "p-001", name: "新しい名前" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("p-001");
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties[""].title[0].text.content).toBe("新しい名前");
    expect(body.properties.頻度).toBeUndefined();
  });

  it("全項目を更新する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            page_id: "p-002",
            name: "更新タスク",
            frequency: "毎月",
            next_date: "2026-05-01",
            template: "更新テンプレ",
            enabled: false,
          },
        },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties[""].title[0].text.content).toBe("更新タスク");
    expect(body.properties.頻度.multi_select[0].name).toBe("毎月");
    expect(body.properties.次回予定日.date.start).toBe("2026-05-01");
    expect(body.properties.テンプレ本文.rich_text[0].text.content).toBe(
      "更新テンプレ",
    );
    expect(body.properties.有効.checkbox).toBe(false);
  });

  it("next_date を null にクリアできる", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "p-003", next_date: null } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.次回予定日.date).toBeNull();
  });

  it("指定しない項目は properties に含まない", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "p-004" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(Object.keys(body.properties)).toHaveLength(0);
  });
});
