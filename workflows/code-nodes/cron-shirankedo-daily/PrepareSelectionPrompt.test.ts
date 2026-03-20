import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareSelectionPrompt from "./PrepareSelectionPrompt";

function callAndGetItems() {
  const result = prepareSelectionPrompt();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareSelectionPrompt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("記事と論文からGemini選定プロンプトを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          articles: [
            {
              title: "React 19 Released",
              url: "https://a.com",
              source: "hackernews",
              description: "Major update",
            },
          ],
          papers: [
            {
              title: "LLM Scaling Laws",
              url: "https://arxiv.org/1",
              source: "arxiv",
              description: "New research",
            },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);
    const prompt = body.contents[0].parts[0].text;

    expect(prompt).toContain("React 19 Released");
    expect(prompt).toContain("LLM Scaling Laws");
  });

  it("geminiBody が有効なJSONである", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          articles: [{ title: "Test", url: "https://a.com", source: "hn" }],
          papers: [],
        },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);

    expect(body).toHaveProperty("contents");
    expect(body).toHaveProperty("generationConfig");
  });

  it("articles と papers をパススルーする", () => {
    const articles = [
      { title: "Article 1", url: "https://a.com", source: "hn" },
      { title: "Article 2", url: "https://b.com", source: "tc" },
    ];
    const papers = [
      { title: "Paper 1", url: "https://arxiv.org/1", source: "arxiv" },
    ];

    vi.stubGlobal("$input", {
      first: () => ({ json: { articles, papers } }),
    });

    const items = callAndGetItems();

    expect(items[0].json.articles).toEqual(articles);
    expect(items[0].json.papers).toEqual(papers);
  });
});
