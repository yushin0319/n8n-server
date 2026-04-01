import { parseGeminiJson } from "../_shared/gemini";

/** Gemini選定結果の型 */
interface SelectionResult {
  articles: {
    index: number;
    title: string;
    source: string;
    impact: number;
    effect: string;
    reason: string;
  }[];
  paper: {
    index: number;
    title: string;
    impact: number;
    reason: string;
  };
}

/** 記事候補の型 */
interface ArticleCandidate {
  title: string;
  url: string;
  source: string;
  pubDate?: string;
}

export default function (): CodeNodeReturn {
  const geminiResponse = $input.first().json;
  const originalData = $("PrepareSelectionPrompt").first().json;
  const articles = originalData.articles as ArticleCandidate[];
  const papers = originalData.papers as ArticleCandidate[];

  const selection = parseGeminiJson<SelectionResult>(geminiResponse);

  // タイトルベースでマッチ（indexが信頼できない場合のフォールバック）
  function findByTitle(
    list: ArticleCandidate[],
    title: string,
  ): ArticleCandidate | null {
    if (!title) return null;
    const norm = title.toLowerCase().trim();
    return (
      list.find((a) => a.title && a.title.toLowerCase().trim() === norm) || null
    );
  }

  const results: INodeExecutionData[] = [];
  for (const a of (selection.articles || []).slice(0, 6)) {
    const idx = (a.index || 1) - 1;
    let original = articles[idx];
    // indexがずれている場合、タイトルで探す
    if (!original || (a.title && original.title !== a.title)) {
      const byTitle = findByTitle(articles, a.title);
      if (byTitle) original = byTitle;
    }
    if (!original) continue;
    results.push({
      json: {
        url: original.url,
        title: a.title || original.title,
        source: original.source,
        impact: a.impact || 5,
        isPaper: 0,
        pubDate: original.pubDate || "",
      },
    });
  }

  const paper = selection.paper;
  if (paper && papers.length > 0) {
    const pidx = (paper.index || 1) - 1;
    let original: ArticleCandidate | null = papers[pidx] || null;
    if (!original || (paper.title && original.title !== paper.title)) {
      const byTitle = findByTitle(papers, paper.title);
      if (byTitle) original = byTitle;
    }
    if (!original) original = papers[0];
    results.push({
      json: {
        url: original.url,
        title: paper.title || original.title,
        source: "arxiv",
        impact: paper.impact || 5,
        isPaper: 1,
        pubDate: original.pubDate || "",
      },
    });
  }

  if (results.length === 0) {
    throw new Error(
      "ParseSelection: 選定結果が0件\narticles候補: " +
        articles.length +
        "件, papers候補: " +
        papers.length +
        "件\nGemini selection: " +
        JSON.stringify(selection).substring(0, 500),
    );
  }
  return results;
}
