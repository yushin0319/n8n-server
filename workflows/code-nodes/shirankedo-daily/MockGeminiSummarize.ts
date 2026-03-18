import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiSummarize のモック.
 * テストモード時にGemini APIを呼ばず、記事要約結果を返す。
 * FormatArticles.ts が期待するGeminiレスポンス形式で返す。
 */
export function mockGeminiSummarize(): IDataObject {
  const summaries = [
    {
      article_index: 1,
      tags: ["test"],
      title_ja: "テスト記事",
      summary: "テスト要約",
      comment: "テストコメント",
    },
  ];
  return mockGeminiResponse(JSON.stringify(summaries));
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiSummarize() }];
}
