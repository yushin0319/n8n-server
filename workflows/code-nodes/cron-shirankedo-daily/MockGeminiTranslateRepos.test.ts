import { describe, expect, it } from "vitest";
import { mockGeminiTranslateRepos } from "./MockGeminiTranslateRepos";

describe("mockGeminiTranslateRepos", () => {
  it("Geminiレスポンス形式でモックデータを返す", () => {
    const result = mockGeminiTranslateRepos();
    const text = result.candidates[0].content.parts[0].text;
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("番号付きリスト形式の翻訳テキストを返す", () => {
    const result = mockGeminiTranslateRepos();
    const text = result.candidates[0].content.parts[0].text;
    expect(text).toBe("1. テストリポ | テスト説明");
  });
});
