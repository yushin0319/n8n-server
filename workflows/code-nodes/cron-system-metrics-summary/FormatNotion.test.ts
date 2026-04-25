import { describe, expect, it, vi } from "vitest";
import formatNotion from "./FormatNotion";

interface NotionPostBody {
  action: string;
  date: string;
  total: number;
  success: number;
  error: number;
  waiting: number;
  error_rate_pct: number;
  avg_duration_sec: number;
  coverage_hours: number;
  top_wf: string;
  recent_errors: string;
}

function setup(stats: Record<string, unknown>) {
  vi.stubGlobal("$input", {
    first: () => ({ json: stats }),
  });
}

function run(): NotionPostBody {
  const result = formatNotion();
  const arr = Array.isArray(result) ? result : [result];
  return (arr[0] as { json: NotionPostBody }).json;
}

const baseStats = {
  total: 100,
  success: 99,
  error: 1,
  waiting: 0,
  errorRatePct: 1.0,
  avgDurationSec: 1.5,
  coverageHours: 12.3,
  topByCount: [],
  recentErrors: [],
};

describe("FormatNotion", () => {
  it("action=create と日付を出す", () => {
    setup(baseStats);
    const out = run();
    expect(out.action).toBe("create");
    expect(out.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("数値プロパティを通す", () => {
    setup(baseStats);
    const out = run();
    expect(out.total).toBe(100);
    expect(out.error).toBe(1);
    expect(out.error_rate_pct).toBe(1.0);
    expect(out.avg_duration_sec).toBe(1.5);
    expect(out.coverage_hours).toBe(12.3);
  });

  it("topByCount を改行区切りで整形", () => {
    setup({
      ...baseStats,
      topByCount: [
        { name: "cron/x", count: 100, errors: 0 },
        { name: "cron/y", count: 50, errors: 1 },
      ],
    });
    const out = run();
    expect(out.top_wf).toBe("cron/x: 100\ncron/y: 50 (err 1)");
  });

  it("recentErrors を整形", () => {
    setup({
      ...baseStats,
      recentErrors: [
        { wfName: "cron/foo", id: "12345", startedAt: "2026-04-25T03:14:15Z" },
      ],
    });
    const out = run();
    expect(out.recent_errors).toContain("[12345]");
    expect(out.recent_errors).toContain("cron/foo");
    expect(out.recent_errors).toContain("2026-04-25 03:14:15");
  });

  it("空配列でも空文字を返す", () => {
    setup(baseStats);
    const out = run();
    expect(out.top_wf).toBe("");
    expect(out.recent_errors).toBe("");
  });
});
