import { describe, expect, it } from "vitest";
import { mockClassify } from "./MockClassify";

describe("mockClassify", () => {
  it("メール数に応じた classifications 配列を直接返す", () => {
    const emails = [
      { subject: "テスト1", from: "a@b.com", snippet: "..." },
      { subject: "テスト2", from: "c@d.com", snippet: "..." },
    ];
    const result = mockClassify(emails);

    expect(result.classifications).toHaveLength(2);
    expect(result.classifications[0]).toEqual({ index: 1, importance: "確認" });
    expect(result.classifications[1]).toEqual({ index: 2, importance: "確認" });
  });

  it("空配列なら空の分類結果を返す", () => {
    const result = mockClassify([]);
    expect(result.classifications).toEqual([]);
  });
});
