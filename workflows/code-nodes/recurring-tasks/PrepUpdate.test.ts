import { describe, expect, it, vi, beforeEach } from "vitest";
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

    const parsed = JSON.parse(items[0].json.requestBody as string);
    // 最終実行日は今日（JST）
    expect(parsed.properties["最終実行日"].date.start).toBe("2026-03-17");
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
    const parsed = JSON.parse(items[0].json.requestBody as string);
    // 次回予定日が設定されていること
    expect(parsed.properties["次回予定日"].date.start).toBeTruthy();
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
    const parsed = JSON.parse(items[0].json.requestBody as string);
    expect(parsed.properties["次回予定日"].date.start).toBeTruthy();
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
    const parsed = JSON.parse(items[0].json.requestBody as string);
    expect(parsed.properties["次回予定日"].date.start).toBeTruthy();
  });
});
