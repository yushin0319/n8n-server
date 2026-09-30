import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import buildQuery from "./BuildQuery";

function run() {
  const result = buildQuery();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("BuildQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 23:00 JST = 14:00 UTC（日次まとめの発火時刻）
    vi.setSystemTime(new Date("2026-09-30T14:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("観測性 DB の query URL を返す", () => {
    const items = run();
    expect(items[0].json.url).toBe(
      "https://api.notion.com/v1/databases/3552570f-e49f-80a6-9186-c1a14b7d9547/query",
    );
  });

  it("直近 24h の critical / warning / crypto-ai-trader の約定 を OR で取る", () => {
    const body = JSON.parse(run()[0].json.requestBody as string);
    const since = {
      property: "timestamp",
      date: { on_or_after: "2026-09-29T14:00:00.000Z" },
    };
    expect(body.filter).toEqual({
      or: [
        {
          and: [
            since,
            { property: "severity", select: { equals: "critical" } },
          ],
        },
        {
          and: [since, { property: "severity", select: { equals: "warning" } }],
        },
        {
          and: [
            since,
            { property: "severity", select: { equals: "info" } },
            { property: "service", select: { equals: "crypto-ai-trader" } },
            { property: "subject", title: { contains: "約定" } },
          ],
        },
      ],
    });
  });

  it("時系列昇順・1 ページ最大 100 件", () => {
    const body = JSON.parse(run()[0].json.requestBody as string);
    expect(body.sorts).toEqual([
      { property: "timestamp", direction: "ascending" },
    ]);
    expect(body.page_size).toBe(100);
  });
});
