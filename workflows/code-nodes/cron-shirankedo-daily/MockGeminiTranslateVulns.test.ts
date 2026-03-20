import { describe, expect, it } from "vitest";
import { mockGeminiTranslateVulns } from "./MockGeminiTranslateVulns";

describe("mockGeminiTranslateVulns", () => {
  it("Geminiレスポンス形式で翻訳結果を返す", () => {
    const result = mockGeminiTranslateVulns();

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      index: 1,
      title: "テスト脆弱性タイトル",
    });
  });

  it("FormatVulnerabilities が期待するフィールドを含む", () => {
    const result = mockGeminiTranslateVulns();
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    const entry = parsed[0];

    expect(entry).toHaveProperty("index");
    expect(entry).toHaveProperty("title");
    expect(typeof entry.index).toBe("number");
    expect(typeof entry.title).toBe("string");
  });

  it("candidates[0].content.parts[0].text がJSON文字列である", () => {
    const result = mockGeminiTranslateVulns();
    const text = result.candidates[0].content.parts[0].text;

    expect(typeof text).toBe("string");
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
