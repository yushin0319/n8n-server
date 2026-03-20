import { stripHtmlTags } from "../_shared/stripHtmlTags";

/** 記事データの型 */
interface ArticleItem {
  title: string;
  url: string;
  description?: string;
  source: string;
  link?: string;
  contentSnippet?: string;
}

/** URL正規化: トラッキングパラメータ除去、ホスト正規化 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const tracking = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "source",
      "via",
      "fbclid",
      "gclid",
    ]);
    const params = new URLSearchParams(u.search);
    for (const key of [...params.keys()]) {
      if (tracking.has(key.toLowerCase())) params.delete(key);
    }
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const qs = params.toString();
    return "https://" + host + path + (qs ? "?" + qs : "");
  } catch {
    return url;
  }
}

/** RSSノードからアイテムを抽出 */
function extractRssItems(nodeName: string, sourceName: string): ArticleItem[] {
  try {
    const items = $(nodeName).all();
    return items.map((item) => {
      const d = item.json;
      return {
        title: ((d.title as string) || "").substring(0, 200),
        url: (d.link as string) || (d.url as string) || "",
        description: stripHtmlTags(
          (d.contentSnippet as string) || (d.description as string) || "",
        ).substring(0, 200),
        source: sourceName,
      };
    });
  } catch {
    return [];
  }
}

export default function (): CodeNodeReturn {
  // 全ソースの記事を集約し、URL正規化+既存排除+重複統合
  // WaitAllFeeds(Merge)経由で全フィード完了後に実行される
  const existingData = $("FetchExistingURLs").first().json;
  const existingURLs = new Set(
    ((existingData.data as string[]) || []).map((u) => u.toLowerCase()),
  );

  const rssItems: ArticleItem[] = [
    ...extractRssItems("FetchHN", "hackernews"),
    ...extractRssItems("FetchHatena", "hatena"),
    ...extractRssItems("FetchZenn", "zenn"),
    ...extractRssItems("FetchLobsters", "lobsters"),
  ];

  // arXiv: ParseArXiv または ArXivFallback のどちらかから取得
  let arxivItems: ArticleItem[] = [];
  try {
    arxivItems = $("ParseArXiv")
      .all()
      .map((item) => item.json as unknown as ArticleItem);
  } catch {
    try {
      arxivItems = $("ArXivFallback")
        .all()
        .map((item) => item.json as unknown as ArticleItem);
    } catch {
      arxivItems = [];
    }
  }

  // 重複排除
  const seen = new Set<string>();
  const articles: ArticleItem[] = [];
  for (const item of rssItems) {
    if (!item.url || !item.title) continue;
    const norm = normalizeUrl(item.url);
    if (seen.has(norm) || existingURLs.has(norm.toLowerCase())) continue;
    seen.add(norm);
    articles.push(item);
  }

  const papers: ArticleItem[] = [];
  for (const item of arxivItems) {
    if (!item.url || !item.title) continue;
    const norm = normalizeUrl(item.url);
    if (seen.has(norm) || existingURLs.has(norm.toLowerCase())) continue;
    seen.add(norm);
    papers.push(item);
  }

  return [
    {
      json: {
        articles,
        papers,
        articleCount: articles.length,
        paperCount: papers.length,
      },
    },
  ];
}

// テスト用にエクスポート
export { normalizeUrl };
