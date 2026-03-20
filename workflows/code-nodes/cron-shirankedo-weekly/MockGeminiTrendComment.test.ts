import { describe, expect, it } from "vitest";
import { mockGeminiTrendComment } from "./MockGeminiTrendComment";

describe("mockGeminiTrendComment", () => {
  it("Geminiレスポンス形式でモックデータを返す", () => {
    const result = mockGeminiTrendComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("プレーンテキストのトレンドコメントを返す", () => {
    const result = mockGeminiTrendComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(text).toBe("テスト用トレンドコメント");
  });
});
