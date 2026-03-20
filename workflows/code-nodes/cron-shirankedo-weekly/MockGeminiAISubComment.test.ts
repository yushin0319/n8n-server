import { describe, expect, it } from "vitest";
import { mockGeminiAISubComment } from "./MockGeminiAISubComment";

describe("mockGeminiAISubComment", () => {
  it("Geminiレスポンス形式でモックデータを返す", () => {
    const result = mockGeminiAISubComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("プレーンテキストのAIサブスクリプションコメントを返す", () => {
    const result = mockGeminiAISubComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(text).toBe("テスト用AIサブスクリプションコメント");
  });
});
