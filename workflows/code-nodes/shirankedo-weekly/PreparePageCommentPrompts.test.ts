import { beforeEach, describe, expect, it, vi } from "vitest";
import preparePageCommentPrompts from "./PreparePageCommentPrompts";

function callAndGetItems() {
  const result = preparePageCommentPrompts();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PreparePageCommentPrompts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("サマリーがある場合にhasSummaries=trueとプロンプトを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: [
            { content: "今週のサマリー1" },
            { content: "今週のサマリー2" },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(true);
    expect(items[0].json.trendPrompt).toBeDefined();
    expect(items[0].json.aiApiPrompt).toBeDefined();
    expect(items[0].json.aiSubPrompt).toBeDefined();
    // プロンプトにサマリー内容が含まれる
    expect(items[0].json.trendPrompt).toContain("今週のサマリー1");
  });

  it("サマリーがない場合にhasSummaries=falseを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(false);
  });
});
