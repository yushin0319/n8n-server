import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCreate from "./PrepCreate";

describe("PrepCreate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("必須項目のみで作成できる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { name: "月次レポート" } } }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.parent.database_id).toBe(
      "3142570f-e49f-80cf-8383-cc62030339c9",
    );
    expect(body.properties[""].title[0].text.content).toBe("月次レポート");
    expect(body.properties["頻度"].multi_select[0].name).toBe("毎週");
    expect(body.properties["有効"].checkbox).toBe(true);
  });

  it("name がない場合エラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    expect(() => prepCreate()).toThrow("body.name は必須です");
  });

  it("body が undefined の場合エラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    expect(() => prepCreate()).toThrow("body.name は必須です");
  });

  it("全オプション項目を含める", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            name: "日次バックアップ",
            frequency: "毎日",
            next_date: "2026-04-01",
            template: "バックアップ実行",
            enabled: false,
          },
        },
      }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["頻度"].multi_select[0].name).toBe("毎日");
    expect(body.properties["次回予定日"].date.start).toBe("2026-04-01");
    expect(body.properties["テンプレ本文"].rich_text[0].text.content).toBe(
      "バックアップ実行",
    );
    expect(body.properties["有効"].checkbox).toBe(false);
  });

  it("next_date が空の場合は次回予定日を含めない", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { name: "テスト" } } }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["次回予定日"]).toBeUndefined();
  });
});
