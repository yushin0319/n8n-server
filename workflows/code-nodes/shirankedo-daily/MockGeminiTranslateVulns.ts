/**
 * GeminiTranslateVulns のモック.
 * テストモード時にGemini APIを呼ばず、脆弱性タイトル翻訳結果を返す。
 * FormatVulnerabilities.ts が期待するGeminiレスポンス形式で返す。
 */
export function mockGeminiTranslateVulns(): IDataObject {
  const titles = [
    {
      index: 1,
      title: "テスト脆弱性タイトル",
    },
  ];
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(titles) }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiTranslateVulns() }];
}
