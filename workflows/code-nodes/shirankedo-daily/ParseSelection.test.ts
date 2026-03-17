import { describe, expect, it, vi, beforeEach } from "vitest";
import parseSelection from "./ParseSelection";

function callAndGetItems() {
  const result = parseSelection();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** Geminiレスポンスのヘルパー */
function geminiResponse(data: unknown) {
  return {
    candidates: [
      { content: { parts: [{ text: JSON.stringify(data) }] } },
    ],
  };
}

describe("ParseSelection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("インデックスで記事を選定する", () => {
    const selection = {
      articles: [
        { index: 1, title: "Article A", source: "hackernews", impact: 8, effect: "すぐ動く", reason: "重要" },
        { index: 2, title: "Article B", source: "techcrunch", impact: 6, effect: "知見が増える", reason: "参考" },
      ],
      paper: null,
    };
    const articles = [
      { title: "Article A", url: "https://a.com", source: "hackernews" },
      { title: "Article B", url: "https://b.com", source: "techcrunch" },
    ];

    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(selection) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSelectionPrompt") {
        return {
          first: () => ({ json: { articles, papers: [] } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(2);
    expect(items[0].json.url).toBe("https://a.com");
    expect(items[0].json.isPaper).toBe(0);
    expect(items[1].json.url).toBe("https://b.com");
  });

  it("論文選定時は isPaper=1 を設定する", () => {
    const selection = {
      articles: [
        { index: 1, title: "Article A", source: "hackernews", impact: 8, effect: "すぐ動く", reason: "重要" },
      ],
      paper: { index: 1, title: "ML Paper", impact: 7, reason: "注目" },
    };
    const articles = [
      { title: "Article A", url: "https://a.com", source: "hackernews" },
    ];
    const papers = [
      { title: "ML Paper", url: "https://arxiv.org/paper1", source: "arxiv" },
    ];

    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(selection) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSelectionPrompt") {
        return {
          first: () => ({ json: { articles, papers } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    const paperItem = items.find((i) => i.json.isPaper === 1);
    expect(paperItem).toBeDefined();
    expect(paperItem!.json.source).toBe("arxiv");
  });

  it("選定結果が0件の場合はエラーを投げる", () => {
    const selection = {
      articles: [],
      paper: null,
    };

    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(selection) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSelectionPrompt") {
        return {
          first: () => ({ json: { articles: [{ title: "A", url: "https://a.com", source: "hn" }], papers: [] } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    expect(() => callAndGetItems()).toThrow("選定結果が0件");
  });
});
