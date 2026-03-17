import { describe, expect, it } from "vitest";
import { mockGeminiWeeklyReport } from "./MockGeminiWeeklyReport";

describe("mockGeminiWeeklyReport", () => {
  it("Geminiレスポンス形式でモックデータを返す", () => {
    const result = mockGeminiWeeklyReport();
    const text = result.candidates[0].content.parts[0].text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("プレーンテキストの週次レポートを返す", () => {
    const result = mockGeminiWeeklyReport();
    const text = result.candidates[0].content.parts[0].text;
    expect(text).toBe("テスト用週次レポート内容");
  });
});
