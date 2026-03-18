import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiSelect のモック.
 * テストモード時にGemini APIを呼ばず、記事選定結果を返す。
 * ParseSelection.ts が期待するGeminiレスポンス形式で返す。
 */
export function mockGeminiSelect(): IDataObject {
  const selection = {
    articles: [
      {
        index: 1,
        title: "Mock Article",
        source: "test",
        impact: 5,
        effect: "テスト",
        reason: "テスト用",
      },
    ],
    paper: {
      index: 1,
      title: "Mock Paper",
      impact: 5,
      reason: "テスト用",
    },
  };
  return mockGeminiResponse(JSON.stringify(selection));
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiSelect() }];
}
