import { describe, expect, it, vi } from "vitest";
import formatLatest from "./FormatLatest";

interface LatestOutput {
  action: string;
  count: number;
  row: {
    id?: string;
    date?: string;
    total: number | null;
    error: number | null;
    error_rate_pct: number | null;
  } | null;
  message?: string;
}

function setup(items: unknown[]) {
  vi.stubGlobal("$input", {
    all: () => items.map((json) => ({ json })),
  });
}

function run(): LatestOutput {
  const result = formatLatest();
  const arr = Array.isArray(result) ? result : [result];
  return (arr[0] as { json: LatestOutput }).json;
}

describe("FormatLatest", () => {
  it("空入力で count=0 を返す", () => {
    setup([]);
    const out = run();
    expect(out.count).toBe(0);
    expect(out.row).toBeNull();
    expect(out.message).toContain("DB は空");
  });

  it("Notion page を整形する", () => {
    setup([
      {
        id: "page1",
        url: "https://notion.so/page1",
        last_edited_time: "2026-04-25T09:00:00Z",
        properties: {
          日付: { title: [{ plain_text: "2026-04-25" }] },
          total: { number: 600 },
          error: { number: 1 },
          error_rate_pct: { number: 0.17 },
          top_wf: { rich_text: [{ plain_text: "cron/x: 100" }] },
        },
      },
    ]);
    const out = run();
    expect(out.count).toBe(1);
    expect(out.row?.id).toBe("page1");
    expect(out.row?.date).toBe("2026-04-25");
    expect(out.row?.total).toBe(600);
    expect(out.row?.error).toBe(1);
  });

  it("プロパティ欠損で null になる", () => {
    setup([
      {
        id: "page2",
        properties: {},
      },
    ]);
    const out = run();
    expect(out.row?.total).toBeNull();
    expect(out.row?.error_rate_pct).toBeNull();
  });
});
