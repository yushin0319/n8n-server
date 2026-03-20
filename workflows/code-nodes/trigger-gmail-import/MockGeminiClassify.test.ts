import { describe, expect, it } from "vitest";
import { mockGeminiClassify } from "./MockGeminiClassify";

describe("mockGeminiClassify", () => {
  it("メール数に応じた分類結果をGeminiレスポンス形式で返す", () => {
    const emails = [
      { subject: "テスト1", from: "a@b.com", snippet: "..." },
      { subject: "テスト2", from: "c@d.com", snippet: "..." },
    ];
    const result = mockGeminiClassify(emails);

    // Gemini API レスポンス形式
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ index: 1, importance: "確認" });
    expect(parsed[1]).toEqual({ index: 2, importance: "確認" });
  });

  it("空配列なら空の分類結果を返す", () => {
    const result = mockGeminiClassify([]);
    const text = result.candidates[0].content.parts[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });
});
