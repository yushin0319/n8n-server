import { beforeEach, describe, expect, it, vi } from "vitest";
import formatSearch from "./FormatSearch";

describe("FormatSearch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("タスクのプロパティを抽出する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-1",
            url: "https://notion.so/page-1",
            properties: {
              "": { title: [{ plain_text: "検索タスク" }] },
              ステータス: { status: { name: "進行中" } },
              ID: { unique_id: { number: 10 } },
              最終更新日時: { last_edited_time: "2026-01-15T00:00:00Z" },
            },
          },
        },
      ],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(1);
    const tasks = result[0].json.tasks as IDataObject[];
    expect(tasks[0].title).toBe("検索タスク");
    expect(tasks[0].status).toBe("進行中");
    expect(tasks[0].task_id).toBe(10);
  });

  it("action が 'search' を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-1",
            url: "https://notion.so/page-1",
            properties: {
              "": { title: [{ plain_text: "タスク" }] },
              ステータス: { status: { name: "完了" } },
              ID: { unique_id: { number: 1 } },
              最終更新日時: { last_edited_time: "" },
            },
          },
        },
      ],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.action).toBe("search");
  });

  it("空の results を処理する", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.action).toBe("search");
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.tasks).toEqual([]);
  });
});
