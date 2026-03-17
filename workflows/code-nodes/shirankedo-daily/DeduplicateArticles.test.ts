import { describe, expect, it, vi, beforeEach } from "vitest";
import deduplicateArticles, { normalizeUrl } from "./DeduplicateArticles";

function callAndGetItems() {
  const result = deduplicateArticles();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("normalizeUrl", () => {
  it("トラッキングパラメータを除去する", () => {
    const url =
      "https://example.com/article?utm_source=twitter&utm_medium=social&id=123";
    expect(normalizeUrl(url)).toBe("https://example.com/article?id=123");
  });

  it("wwwプレフィックスを除去する", () => {
    expect(normalizeUrl("https://www.example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("末尾スラッシュを正規化する", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path",
    );
  });

  it("不正なURLはそのまま返す", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });

  it("パラメータがすべてトラッキングの場合、クエリなしにする", () => {
    expect(
      normalizeUrl("https://example.com/page?utm_source=x&fbclid=abc"),
    ).toBe("https://example.com/page");
  });
});

describe("DeduplicateArticles", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("複数ソースの記事を集約し重複を排除する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      const nodes: Record<string, { all: () => INodeExecutionData[] }> = {
        FetchExistingURLs: {
          all: () => [{ json: { data: [] } }],
        },
        FetchHN: {
          all: () => [
            {
              json: {
                title: "Article A",
                link: "https://example.com/a",
                contentSnippet: "desc a",
              },
            },
          ],
        },
        FetchHatena: {
          all: () => [
            {
              json: {
                title: "Article B",
                link: "https://example.com/b",
                contentSnippet: "desc b",
              },
            },
          ],
        },
        FetchZenn: { all: () => [] },
        FetchLobsters: { all: () => [] },
        ParseArXiv: {
          all: () => [
            {
              json: {
                title: "Paper X",
                url: "http://arxiv.org/abs/1",
                source: "arxiv",
              },
            },
          ],
        },
      };
      const node = nodes[nodeName];
      if (!node) throw new Error(`Node ${nodeName} not found`);
      return { ...node, first: () => node.all()[0] };
    });

    const items = callAndGetItems();
    const data = items[0].json;

    expect(data.articleCount).toBe(2);
    expect(data.paperCount).toBe(1);
    expect((data.articles as IDataObject[])[0].title).toBe("Article A");
    expect((data.papers as IDataObject[])[0].title).toBe("Paper X");
  });

  it("既存URLは除外する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      const nodes: Record<string, { all: () => INodeExecutionData[] }> = {
        FetchExistingURLs: {
          all: () => [{ json: { data: ["https://example.com/a"] } }],
        },
        FetchHN: {
          all: () => [
            {
              json: {
                title: "Article A",
                link: "https://example.com/a",
                contentSnippet: "desc",
              },
            },
            {
              json: {
                title: "Article B",
                link: "https://example.com/b",
                contentSnippet: "desc",
              },
            },
          ],
        },
        FetchHatena: { all: () => [] },
        FetchZenn: { all: () => [] },
        FetchLobsters: { all: () => [] },
        ParseArXiv: { all: () => [] },
      };
      const node = nodes[nodeName];
      if (!node) throw new Error(`Node ${nodeName} not found`);
      return { ...node, first: () => node.all()[0] };
    });

    const items = callAndGetItems();
    expect(items[0].json.articleCount).toBe(1);
    expect((items[0].json.articles as IDataObject[])[0].title).toBe(
      "Article B",
    );
  });

  it("同一URLの重複記事は1つだけ残す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      const nodes: Record<string, { all: () => INodeExecutionData[] }> = {
        FetchExistingURLs: {
          all: () => [{ json: { data: [] } }],
        },
        FetchHN: {
          all: () => [
            {
              json: {
                title: "Same Article",
                link: "https://example.com/dup",
                contentSnippet: "from HN",
              },
            },
          ],
        },
        FetchHatena: {
          all: () => [
            {
              json: {
                title: "Same Article",
                link: "https://example.com/dup?utm_source=hatena",
                contentSnippet: "from Hatena",
              },
            },
          ],
        },
        FetchZenn: { all: () => [] },
        FetchLobsters: { all: () => [] },
        ParseArXiv: { all: () => [] },
      };
      const node = nodes[nodeName];
      if (!node) throw new Error(`Node ${nodeName} not found`);
      return { ...node, first: () => node.all()[0] };
    });

    const items = callAndGetItems();
    // UTMパラメータ除去で同一URLとなり重複排除される
    expect(items[0].json.articleCount).toBe(1);
  });

  it("ParseArXiv失敗時はArXivFallbackを試す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      const nodes: Record<string, { all: () => INodeExecutionData[] }> = {
        FetchExistingURLs: {
          all: () => [{ json: { data: [] } }],
        },
        FetchHN: { all: () => [] },
        FetchHatena: { all: () => [] },
        FetchZenn: { all: () => [] },
        FetchLobsters: { all: () => [] },
        ArXivFallback: {
          all: () => [
            {
              json: {
                title: "arXiv empty",
                url: "",
                source: "arxiv",
              },
            },
          ],
        },
      };
      if (nodeName === "ParseArXiv") throw new Error("ParseArXiv failed");
      const node = nodes[nodeName];
      if (!node) throw new Error(`Node ${nodeName} not found`);
      return { ...node, first: () => node.all()[0] };
    });

    // arXiv emptyはurl空なのでpapers=0
    const items = callAndGetItems();
    expect(items[0].json.paperCount).toBe(0);
  });
});
