import { beforeEach, describe, expect, it, vi } from "vitest";
import prepUpdate from "./PrepUpdate";

function callAndGetItems() {
  const result = prepUpdate();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // 2026-03-17 00:00:00 UTC
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-17T00:00:00Z").getTime(),
    );
  });

  it("weekly: currentNextDate から +7 日を next_date にする（曜日固定）", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-1",
            taskName: "週次レビュー",
            frequency: "weekly",
            // 月曜
            currentNextDate: "2026-03-16",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.pageId).toBe("page-1");
    // 最終実行日は今日（JST, 2026-03-17）
    expect(items[0].json.lastExecuted).toBe("2026-03-17");
    // next は 2026-03-16 + 7 = 2026-03-23 (月曜維持)
    expect(items[0].json.nextDate).toBe("2026-03-23");
  });

  it("weekly: WF 遅延発火でも曜日が固定される", () => {
    // 今日を 2026-03-19（木）に設定、currentNextDate は 2026-03-16（月）
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-19T00:00:00Z").getTime(),
    );
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-2",
            taskName: "週次レビュー",
            frequency: "weekly",
            currentNextDate: "2026-03-16",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // next は 2026-03-23（月曜維持、3日遅延しても曜日はズレない）
    expect(items[0].json.nextDate).toBe("2026-03-23");
  });

  it("weekly: 遅延が長い場合は次の未来日までキャッチアップする", () => {
    // 今日を 2026-03-30（月）に設定、currentNextDate は 2026-03-09（月、3週間前）
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-30T00:00:00Z").getTime(),
    );
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-3",
            taskName: "週次レビュー",
            frequency: "weekly",
            currentNextDate: "2026-03-09",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // 3-09 + 7 = 3-16 (<= today) → 3-23 (<= today) → 3-30 (== today) → 4-06
    expect(items[0].json.nextDate).toBe("2026-04-06");
  });

  it("daily: currentNextDate から +1 日", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-4",
            taskName: "日次チェック",
            frequency: "daily",
            currentNextDate: "2026-03-17",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items[0].json.nextDate).toBe("2026-03-18");
  });

  it("every_3_days: currentNextDate から +3 日", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-5",
            taskName: "3日おき",
            frequency: "every_3_days",
            currentNextDate: "2026-03-14",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // 3-14 + 3 = 3-17 (== today) → 3-20
    expect(items[0].json.nextDate).toBe("2026-03-20");
  });

  it("monthly: currentNextDate から +1 ヶ月", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-6",
            taskName: "月次確認",
            frequency: "monthly",
            currentNextDate: "2026-02-15",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // 2-15 + 1 month = 3-15 (<= today 3-17) → 4-15
    expect(items[0].json.nextDate).toBe("2026-04-15");
  });

  it("currentNextDate 未設定（初回）は today ベースで加算する", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-7",
            taskName: "初回weekly",
            frequency: "weekly",
            currentNextDate: "",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // today = 3-17, +7 = 3-24
    expect(items[0].json.nextDate).toBe("2026-03-24");
  });

  it("不明な frequency は 30 日後として扱う", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-8",
            taskName: "不明頻度",
            frequency: "unknown_freq",
            currentNextDate: "2026-03-17",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items[0].json.nextDate).toBe("2026-04-16");
  });
});
