import { beforeEach, describe, expect, it, vi } from "vitest";
import extractPageId from "./ExtractPageId";

describe("ExtractPageId", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("results[0].id を pageId として返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [{ id: "page-abc-123" }, { id: "page-def-456" }],
        },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { taskId: 558 } }),
    }));

    const result = extractPageId() as INodeExecutionData[];
    expect(result[0].json.pageId).toBe("page-abc-123");
    expect(result[0].json.taskId).toBe(558);
  });

  it("results が空の場合 task_id 付きエラーをスロー", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: [] } }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { taskId: 999 } }),
    }));

    expect(() => extractPageId()).toThrow("task_id 999 に一致するタスク");
  });
});
