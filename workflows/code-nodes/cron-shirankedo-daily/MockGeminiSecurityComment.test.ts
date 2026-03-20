import { describe, expect, it } from "vitest";
import { mockGeminiSecurityComment } from "./MockGeminiSecurityComment";

describe("mockGeminiSecurityComment", () => {
  it("Geminiレスポンス形式でセキュリティコメントを返す", () => {
    const result = mockGeminiSecurityComment();

    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed).toEqual({
      comment: "テスト用セキュリティコメント",
      vuln_ids: [],
      release_ids: [],
    });
  });

  it("FormatSecurityDaily が期待するフィールドを全て含む", () => {
    const result = mockGeminiSecurityComment();
    const text = result.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveProperty("comment");
    expect(parsed).toHaveProperty("vuln_ids");
    expect(parsed).toHaveProperty("release_ids");
    expect(typeof parsed.comment).toBe("string");
    expect(Array.isArray(parsed.vuln_ids)).toBe(true);
    expect(Array.isArray(parsed.release_ids)).toBe(true);
  });

  it("candidates[0].content.parts[0].text がJSON文字列である", () => {
    const result = mockGeminiSecurityComment();
    const text = result.candidates[0].content.parts[0].text;

    expect(typeof text).toBe("string");
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
