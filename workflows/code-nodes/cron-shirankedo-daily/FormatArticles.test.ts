import { beforeEach, describe, expect, it, vi } from "vitest";
import formatArticles from "./FormatArticles";

function callAndGetItems() {
  const result = formatArticles();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** Geminiレスポンスのヘルパー */
function geminiResponse(data: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
  };
}

describe("FormatArticles", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("要約データと元データをマージして整形する", () => {
    const summaries = [
      {
        article_index: 1,
        tags: ["AI"],
        title_ja: "",
        summary: "要約テキスト",
        comment: "コメント",
      },
    ];
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(summaries) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSummaryPrompt") {
        return {
          first: () => ({
            json: {
              items: [
                {
                  url: "https://example.com",
                  title: "Original Title",
                  source: "hackernews",
                  impact: 7,
                  isPaper: 0,
                },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Original Title");
    expect(body[0].summary).toBe("要約テキスト");
    expect(items[0].json.articleCount).toBe(1);
  });

  it("整形後0件の場合はエラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse([]) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSummaryPrompt") {
        return {
          first: () => ({ json: { items: [] } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    expect(() => callAndGetItems()).toThrow("整形後の記事が0件");
  });

  it("pubDate があれば ISO 形式で publishedAt に使用する", () => {
    const summaries = [
      {
        article_index: 1,
        tags: ["AI"],
        title_ja: "",
        summary: "要約",
        comment: "コメント",
      },
    ];
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(summaries) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSummaryPrompt") {
        return {
          first: () => ({
            json: {
              items: [
                {
                  url: "https://example.com",
                  title: "Title",
                  source: "hackernews",
                  impact: 7,
                  isPaper: 0,
                  pubDate: "Wed, 01 Apr 2026 05:15:37 +0000",
                },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body[0].publishedAt).toBe("2026-04-01T05:15:37.000Z");
  });

  it("pubDate がない場合は WF 実行時刻をフォールバックにする", () => {
    const summaries = [
      {
        article_index: 1,
        tags: ["AI"],
        title_ja: "",
        summary: "要約",
        comment: "コメント",
      },
    ];
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(summaries) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSummaryPrompt") {
        return {
          first: () => ({
            json: {
              items: [
                {
                  url: "https://example.com",
                  title: "Title",
                  source: "hatena",
                  impact: 5,
                  isPaper: 0,
                },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    // フォールバックはISO形式（時刻付き）で、日付だけでないことを確認
    expect(body[0].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("title_ja がある場合は翻訳タイトルを使用する", () => {
    const summaries = [
      {
        article_index: 1,
        tags: ["AI"],
        title_ja: "翻訳タイトル",
        summary: "要約",
        comment: "コメント",
      },
    ];
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(summaries) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSummaryPrompt") {
        return {
          first: () => ({
            json: {
              items: [
                {
                  url: "https://example.com",
                  title: "English Title",
                  source: "hackernews",
                  impact: 7,
                  isPaper: 0,
                },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body[0].title).toBe("翻訳タイトル");
  });
});
