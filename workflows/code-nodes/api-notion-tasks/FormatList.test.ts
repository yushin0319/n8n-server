import { beforeEach, describe, expect, it, vi } from "vitest";
import formatList from "./FormatList";

describe("FormatList", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("タスクのプロパティを正しく抽出する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-1",
            url: "https://notion.so/page-1",
            properties: {
              "": { title: [{ plain_text: "タスク1" }] },
              ステータス: { status: { name: "進行中" } },
              ID: { unique_id: { number: 42 } },
              親タスク: { relation: [{ id: "parent-1" }] },
              子タスク: { relation: [{ id: "child-1" }, { id: "child-2" }] },
              最終更新日時: { last_edited_time: "2026-01-01T00:00:00Z" },
            },
          },
        },
      ],
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.action).toBe("list");
    expect(result[0].json.count).toBe(1);
    const tasks = result[0].json.tasks as IDataObject[];
    expect(tasks[0].id).toBe("page-1");
    expect(tasks[0].task_id).toBe(42);
    expect(tasks[0].title).toBe("タスク1");
    expect(tasks[0].status).toBe("進行中");
    expect(tasks[0].parent_tasks).toEqual(["parent-1"]);
    expect(tasks[0].child_tasks).toEqual(["child-1", "child-2"]);
    expect(tasks[0].last_edited).toBe("2026-01-01T00:00:00Z");
    expect(tasks[0].url).toBe("https://notion.so/page-1");
  });

  it("空の results を処理する", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = formatList() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.tasks).toEqual([]);
  });

  it("タイトルがない場合「(無題)」を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-2",
            url: "https://notion.so/page-2",
            properties: {
              "": { title: [] },
              ステータス: { status: { name: "未着手" } },
              ID: { unique_id: { number: 1 } },
              親タスク: { relation: [] },
              子タスク: { relation: [] },
              最終更新日時: { last_edited_time: "" },
            },
          },
        },
      ],
    });

    const result = formatList() as INodeExecutionData[];
    const tasks = result[0].json.tasks as IDataObject[];
    expect(tasks[0].title).toBe("(無題)");
  });

  it("親タスク・子タスクのリレーションを処理する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            id: "page-3",
            url: "https://notion.so/page-3",
            properties: {
              "": { title: [{ plain_text: "タスク" }] },
              ステータス: { status: { name: "完了" } },
              ID: { unique_id: { number: 5 } },
              親タスク: { relation: [{ id: "p1" }, { id: "p2" }] },
              子タスク: { relation: [] },
              最終更新日時: { last_edited_time: "" },
            },
          },
        },
      ],
    });

    const result = formatList() as INodeExecutionData[];
    const tasks = result[0].json.tasks as IDataObject[];
    expect(tasks[0].parent_tasks).toEqual(["p1", "p2"]);
    expect(tasks[0].child_tasks).toEqual([]);
  });
});
