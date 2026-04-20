import { describe, expect, it } from "vitest";
import { mockClassify } from "./MockClassify";

describe("mockClassify", () => {
  it("メール数に応じた分類結果をOpenRouterレスポンス形式で返す", () => {
    const emails = [
      { subject: "テスト1", from: "a@b.com", snippet: "..." },
      { subject: "テスト2", from: "c@d.com", snippet: "..." },
    ];
    const result = mockClassify(emails);

    const text = (result as any).choices[0].message.content;
    const parsed = JSON.parse(text);
    expect(parsed.classifications).toHaveLength(2);
    expect(parsed.classifications[0]).toEqual({ index: 1, importance: "確認" });
    expect(parsed.classifications[1]).toEqual({ index: 2, importance: "確認" });
  });

  it("空配列なら空の分類結果を返す", () => {
    const result = mockClassify([]);
    const text = (result as any).choices[0].message.content;
    expect(JSON.parse(text).classifications).toEqual([]);
  });
});
