import { beforeEach, describe, expect, it, vi } from "vitest";
import formatResponse from "./FormatResponse";

function callAndGetItems() {
  const r = formatResponse();
  return (Array.isArray(r) ? r : [r]) as INodeExecutionData[];
}

describe("FormatResponse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Notion error は success=false で透過", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          object: "error",
          code: "validation_error",
          message: "x",
          status: 400,
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.success).toBe(false);
    expect(out.error).toMatchObject({ code: "validation_error", status: 400 });
  });

  it("results を flat にして title / select / rich_text / date / url を抽出", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          object: "list",
          results: [
            {
              id: "page1",
              created_time: "2026-05-03T10:00:00.000Z",
              url: "https://www.notion.so/page1",
              properties: {
                subject: {
                  type: "title",
                  title: [{ plain_text: "obs-notify test" }],
                },
                severity: {
                  type: "select",
                  select: { name: "warning" },
                },
                service: {
                  type: "select",
                  select: { name: "n8n" },
                },
                summary: {
                  type: "rich_text",
                  rich_text: [{ plain_text: "詳細メッセージ" }],
                },
                timestamp: {
                  type: "date",
                  date: { start: "2026-05-03T10:00:00+09:00" },
                },
                url: { type: "url", url: "https://example.com/issue" },
              },
            },
          ],
          next_cursor: null,
          has_more: false,
        },
      }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.success).toBe(true);
    expect(out.count).toBe(1);
    expect(out.has_more).toBe(false);
    const r0 = (out.results as Array<Record<string, unknown>>)[0];
    expect(r0.page_id).toBe("page1");
    expect(r0.subject).toBe("obs-notify test");
    expect(r0.severity).toBe("warning");
    expect(r0.service).toBe("n8n");
    expect(r0.summary).toBe("詳細メッセージ");
    expect(r0.timestamp).toBe("2026-05-03T10:00:00+09:00");
    expect(r0.url).toBe("https://example.com/issue");
  });

  it("空 results でも count=0 で返る", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { object: "list", results: [] } }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.count).toBe(0);
    expect(out.results).toEqual([]);
  });
});
