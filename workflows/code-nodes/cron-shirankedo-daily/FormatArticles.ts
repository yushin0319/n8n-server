import { parseGeminiJson } from "../_shared/gemini";

/** Gemini要約結果の型 */
interface SummaryEntry {
  article_index: number;
  tags: string[];
  title_ja: string;
  summary: string;
  comment: string;
}

/** 選定済みアイテムの型 */
interface OriginalItem {
  url: string;
  title: string;
  source: string;
  impact: number;
  isPaper: number;
}

export default function (): CodeNodeReturn {
  const geminiResponse = $input.first().json;
  const originalItems = $("PrepareSummaryPrompt").first().json
    .items as OriginalItem[];

  const summaries = parseGeminiJson<SummaryEntry[]>(geminiResponse);

  const apiBody: IDataObject[] = [];
  for (const s of summaries) {
    const idx = (s.article_index || 1) - 1;
    const orig = originalItems[idx];
    if (!orig) continue;
    // title_ja があれば翻訳タイトルを使用、なければ元タイトル
    const title = s.title_ja || orig.title;
    apiBody.push({
      url: orig.url,
      title,
      source: orig.source,
      summary: s.summary || "",
      comment: s.comment || "",
      tags: s.tags || [],
      impact: orig.impact || 5,
      isPaper: orig.isPaper || 0,
      publishedAt: new Date().toISOString().substring(0, 10),
    });
  }

  if (apiBody.length === 0)
    throw new Error("FormatArticles: 整形後の記事が0件");
  return [
    {
      json: {
        requestBody: JSON.stringify(apiBody),
        articleCount: apiBody.length,
      },
    },
  ];
}
