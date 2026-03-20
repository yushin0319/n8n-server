import { describe, expect, it } from "vitest";
import { mockGeminiSelect } from "./MockGeminiSelect";

describe("mockGeminiSelect", () => {
  it("Geminiレスポンス形式で選定結果を返す", () => {
    const result = mockGeminiSelect();

    // Gemini API レスポンス形式
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0]).toEqual({
      index: 1,
      title: "Mock Article",
      source: "test",
      impact: 5,
      effect: "テスト",
      reason: "テスト用",
    });
  });

  it("paper フィールドを含む", () => {
    const result = mockGeminiSelect();
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.paper).toEqual({
      index: 1,
      title: "Mock Paper",
      impact: 5,
      reason: "テスト用",
    });
  });

  it("candidates[0].content.parts[0].text がJSON文字列である", () => {
    const result = mockGeminiSelect();
    const text = result.candidates[0].content.parts[0].text;

    expect(typeof text).toBe("string");
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
