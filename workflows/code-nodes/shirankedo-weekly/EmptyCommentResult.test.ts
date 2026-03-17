import { describe, expect, it, vi, beforeEach } from "vitest";
import emptyCommentResult from "./EmptyCommentResult";

describe("EmptyCommentResult", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正しいスキップメッセージを返す", () => {
    const result = emptyCommentResult() as INodeExecutionData[];
    expect(result[0].json.message).toBe("サマリーなし、ページコメントスキップ");
  });
});
