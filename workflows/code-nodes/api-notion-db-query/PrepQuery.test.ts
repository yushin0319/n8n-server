import { beforeEach, describe, expect, it, vi } from "vitest";
import prepQuery from "./PrepQuery";

function callAndGetItems() {
  const r = prepQuery();
  return (Array.isArray(r) ? r : [r]) as INodeExecutionData[];
}

describe("PrepQuery", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常系: database_id だけで query URL 構築", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { database_id: "abc123" } } }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.url).toBe("https://api.notion.com/v1/databases/abc123/query");
    expect(JSON.parse(out.requestBody as string)).toEqual({});
  });

  it("filter / sorts / page_size / start_cursor を渡すと requestBody に含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            database_id: "x",
            filter: {
              property: "severity",
              select: { equals: "warning" },
            },
            sorts: [{ property: "timestamp", direction: "descending" }],
            page_size: 50,
            start_cursor: "cursor-abc",
          },
        },
      }),
    });
    const parsed = JSON.parse(callAndGetItems()[0].json.requestBody as string);
    expect(parsed.filter.property).toBe("severity");
    expect(parsed.sorts[0].direction).toBe("descending");
    expect(parsed.page_size).toBe(50);
    expect(parsed.start_cursor).toBe("cursor-abc");
  });

  it("page_size は 1〜100 にクランプ", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { database_id: "x", page_size: 999 } } }),
    });
    const parsed = JSON.parse(callAndGetItems()[0].json.requestBody as string);
    expect(parsed.page_size).toBe(100);
  });

  it("database_id 欠如で throw", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { body: {} } }) });
    expect(() => prepQuery()).toThrow("database_id is required");
  });
});
