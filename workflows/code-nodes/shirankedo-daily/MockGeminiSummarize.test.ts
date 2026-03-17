import { describe, expect, it } from "vitest";
import { mockGeminiSummarize } from "./MockGeminiSummarize";

describe("mockGeminiSummarize", () => {
  it("Geminiレスポンス形式で要約結果を返す", () => {
    const result = mockGeminiSummarize();

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      article_index: 1,
      tags: ["test"],
      title_ja: "テスト記事",
      summary: "テスト要約",
      comment: "テストコメント",
    });
  });

  it("FormatArticles が期待するフィールドを全て含む", () => {
    const result = mockGeminiSummarize();
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    const entry = parsed[0];

    expect(entry).toHaveProperty("article_index");
    expect(entry).toHaveProperty("tags");
    expect(entry).toHaveProperty("title_ja");
    expect(entry).toHaveProperty("summary");
    expect(entry).toHaveProperty("comment");
  });

  it("candidates[0].content.parts[0].text がJSON文字列である", () => {
    const result = mockGeminiSummarize();
    const text = result.candidates[0].content.parts[0].text;

    expect(typeof text).toBe("string");
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
