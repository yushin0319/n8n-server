import { describe, expect, it, vi, beforeEach } from "vitest";
import emptyWeeklyResult from "./EmptyWeeklyResult";

describe("EmptyWeeklyResult", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正しいスキップメッセージを返す", () => {
    const result = emptyWeeklyResult() as INodeExecutionData[];
    expect(result[0].json.message).toBe("記事なし、週次レポートスキップ");
  });
});
