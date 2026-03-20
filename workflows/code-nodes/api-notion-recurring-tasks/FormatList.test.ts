import { beforeEach, describe, expect, it, vi } from "vitest";
import formatList from "./FormatList";

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-001",
    url: "https://notion.so/page-001",
    properties: {
      "": { title: [{ plain_text: "週次レポート" }] },
      頻度: { multi_select: [{ name: "毎週" }] },
      次回予定日: { date: { start: "2026-03-25" } },
      最終実行日: { date: { start: "2026-03-18" } },
      テンプレ本文: { rich_text: [{ plain_text: "レポートを作成" }] },
      有効: { checkbox: true },
    },
    ...overrides,
  };
}

describe("FormatList", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("全プロパティを正しく抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: [makePage()] } }),
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.action).toBe("list");
    expect(result[0].json.count).toBe(1);

    const tasks = result[0].json.tasks as Record<string, unknown>[];
    expect(tasks[0]).toEqual({
      id: "page-001",
      name: "週次レポート",
      frequency: "毎週",
      next_date: "2026-03-25",
      last_executed: "2026-03-18",
      taskTemplate: "レポートを作成",
      enabled: true,
      url: "https://notion.so/page-001",
    });
  });

  it("results が空の場合 count=0, tasks=[]", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: [] } }),
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.tasks).toEqual([]);
  });

  it("プロパティ欠落時にデフォルト値を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { results: [{ id: "page-002", url: null, properties: {} }] },
      }),
    });

    const result = formatList() as INodeExecutionData[];
    const task = (result[0].json.tasks as Record<string, unknown>[])[0];
    expect(task.name).toBe("");
    expect(task.frequency).toBeNull();
    expect(task.next_date).toBeNull();
    expect(task.last_executed).toBeNull();
    expect(task.taskTemplate).toBe("");
    expect(task.enabled).toBe(true);
  });

  it("複数ページを正しく処理する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [
            makePage({ id: "p1" }),
            makePage({ id: "p2" }),
            makePage({ id: "p3" }),
          ],
        },
      }),
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.count).toBe(3);
  });

  it("results が undefined の場合 空配列として処理", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.tasks).toEqual([]);
  });
});
