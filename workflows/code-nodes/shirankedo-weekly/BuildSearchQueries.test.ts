import { describe, expect, it, vi, beforeEach } from "vitest";
import buildSearchQueries from "./BuildSearchQueries";

function callAndGetItems() {
  const result = buildSearchQueries();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("BuildSearchQueries", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // 日付を固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T00:00:00Z"));
  });

  it("5ティア x 2ページ = 10クエリを生成する", () => {
    const items = callAndGetItems();
    expect(items).toHaveLength(10);
  });

  it("各クエリにurl, label, pageが含まれる", () => {
    const items = callAndGetItems();
    for (const item of items) {
      expect(item.json.url).toBeDefined();
      expect(item.json.label).toBeDefined();
      expect(item.json.page).toBeGreaterThanOrEqual(1);
      expect(item.json.page).toBeLessThanOrEqual(2);
    }
  });

  it("Tier1のクエリにstars:>50000が含まれる", () => {
    const items = callAndGetItems();
    const tier1 = items.filter(
      (i) => (i.json.label as string).includes("Tier1"),
    );
    expect(tier1).toHaveLength(2);
    expect(tier1[0].json.url).toContain("stars%3A%3E50000");
  });

  it("Tier5のクエリに30日前の日付が含まれる", () => {
    const items = callAndGetItems();
    const tier5 = items.filter(
      (i) => (i.json.label as string).includes("Tier5"),
    );
    // 2026-03-17 の30日前 = 2026-02-15
    expect(tier5[0].json.url).toContain("2026-02-15");
  });
});
