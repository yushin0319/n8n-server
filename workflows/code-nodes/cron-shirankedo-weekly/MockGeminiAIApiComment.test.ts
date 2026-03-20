import { describe, expect, it } from "vitest";
import { mockGeminiAIApiComment } from "./MockGeminiAIApiComment";

describe("mockGeminiAIApiComment", () => {
  it("Geminiレスポンス形式でモックデータを返す", () => {
    const result = mockGeminiAIApiComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("プレーンテキストのAI APIコメントを返す", () => {
    const result = mockGeminiAIApiComment();
    const text = result.candidates[0].content.parts[0].text;
    expect(text).toBe("テスト用AI APIコメント");
  });
});
