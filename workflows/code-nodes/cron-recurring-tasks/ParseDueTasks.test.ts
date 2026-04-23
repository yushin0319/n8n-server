import { beforeEach, describe, expect, it, vi } from "vitest";
import parseDueTasks from "./ParseDueTasks";

function callAndGetItems() {
  const result = parseDueTasks();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ParseDueTasks", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("結果が空の場合hasDue=falseを返す", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.hasDue).toBe(false);
  });

  it("入力が空配列の場合もhasDue=falseを返す", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const items = callAndGetItems();
    expect(items[0].json.hasDue).toBe(false);
  });

  it("Notionページからタスク情報を正しく抽出する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-id-1",
            properties: {
              タスク名: {
                type: "title",
                title: [{ plain_text: "週次レビュー" }],
              },
              頻度: {
                multi_select: [{ name: "weekly" }],
              },
              テンプレ本文: {
                rich_text: [{ plain_text: "テンプレ内容" }],
              },
              次回予定日: {
                date: { start: "2026-04-19" },
              },
            },
          },
        },
      ],
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.hasDue).toBe(true);
    expect(items[0].json.defPageId).toBe("page-id-1");
    expect(items[0].json.taskName).toBe("週次レビュー");
    expect(items[0].json.frequency).toBe("weekly");
    expect(items[0].json.templateText).toBe("テンプレ内容");
    expect(items[0].json.currentNextDate).toBe("2026-04-19");
  });

  it("頻度が未設定の場合monthlyになる", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-id-2",
            properties: {
              名前: {
                type: "title",
                title: [{ plain_text: "テスト" }],
              },
              頻度: { multi_select: [] },
              テンプレ本文: { rich_text: [] },
            },
          },
        },
      ],
    });

    const items = callAndGetItems();
    expect(items[0].json.frequency).toBe("monthly");
  });
});
