import { beforeEach, describe, expect, it, vi } from "vitest";
import prepGetByTaskId from "./PrepGetByTaskId";

describe("PrepGetByTaskId", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("body.task_id から DB query body を生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { task_id: 558 } },
      }),
    });

    const result = prepGetByTaskId() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.url).toBe(
      "https://api.notion.com/v1/databases/2a02570f-e49f-802b-a67c-fe4c230a5699/query",
    );
    expect(result[0].json.taskId).toBe(558);
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.filter).toEqual({
      property: "ID",
      unique_id: { equals: 558 },
    });
    expect(body.page_size).toBe(1);
  });

  it("直接入力から task_id を読む", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { task_id: 100 } }),
    });

    const result = prepGetByTaskId() as INodeExecutionData[];
    expect(result[0].json.taskId).toBe(100);
  });

  it("task_id が無い場合エラー", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });
    expect(() => prepGetByTaskId()).toThrow("task_id (number) is required");
  });

  it("task_id が文字列の場合エラー", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { task_id: "558" } } }),
    });
    expect(() => prepGetByTaskId()).toThrow("task_id (number) is required");
  });
});
