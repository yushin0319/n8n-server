import { describe, expect, it, vi, beforeEach } from "vitest";
import formatWeeklyReport from "./FormatWeeklyReport";

function callAndGetItems() {
  const result = formatWeeklyReport();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("FormatWeeklyReport", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("レポートコンテンツを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "週次レポート本文" }] } },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.reportContent).toBe("週次レポート本文");
    const body = JSON.parse(items[0].json.requestBody as string);
    expect(body.content).toBe("週次レポート本文");
  });

  it("レスポンスが空の場合に生成失敗を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);
    expect(body.content).toBe("生成失敗");
    expect(items[0].json.reportContent).toBe("");
  });
});
