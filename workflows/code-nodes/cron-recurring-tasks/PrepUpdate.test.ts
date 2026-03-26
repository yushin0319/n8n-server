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

  it("weeklyタスクの次回予定日を7日後に設定する", () => {
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
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.pageId).toBe("page-1");
    expect(items[0].json.taskName).toBe("週次レビュー");
    // 最終実行日は今日（JST）
    expect(items[0].json.lastExecuted).toBe("2026-03-17");
  });

  it("dailyタスクの次回予定日を1日後に設定する", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-2",
            taskName: "日次チェック",
            frequency: "daily",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    // 次回予定日が設定されていること
    expect(items[0].json.nextDate).toBeTruthy();
  });

  it("monthlyタスクの次回予定日を1ヶ月後に設定する", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-3",
            taskName: "月次確認",
            frequency: "monthly",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items[0].json.nextDate).toBeTruthy();
  });

  it("不明なfrequencyはmonthlyとして扱う", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        {
          json: {
            defPageId: "page-4",
            taskName: "不明頻度",
            frequency: "unknown_freq",
          },
        },
      ],
    }));

    const items = callAndGetItems();
    expect(items[0].json.nextDate).toBeTruthy();
  });
});
