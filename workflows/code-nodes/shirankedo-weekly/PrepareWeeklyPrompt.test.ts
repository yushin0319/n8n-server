import { describe, expect, it, vi, beforeEach } from "vitest";
import prepareWeeklyPrompt from "./PrepareWeeklyPrompt";

function callAndGetItems() {
  const result = prepareWeeklyPrompt();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareWeeklyPrompt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("記事からプロンプトを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: [
            { source: "TechCrunch", title: "AI News", summary: "AI進化", tags: "AI" },
            { source: "Verge", title: "New Tool", summary: "ツール紹介", tags: "Dev" },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasArticles).toBe(true);
    expect(items[0].json.count).toBe(2);
    expect(items[0].json.prompt).toContain("AI News");
    expect(items[0].json.prompt).toContain("New Tool");
  });

  it("記事がない場合にhasArticles=falseを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasArticles).toBe(false);
    expect(items[0].json.count).toBe(0);
  });
});
