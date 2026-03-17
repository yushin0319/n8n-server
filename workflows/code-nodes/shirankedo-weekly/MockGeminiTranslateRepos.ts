/**
 * GeminiTranslateRepos のモック.
 * テストモード時にGemini APIを呼ばず、リポジトリ翻訳を返す。
 * AccumulateTranslations.ts が期待するGeminiレスポンス形式（番号付きリスト）で返す。
 */
export function mockGeminiTranslateRepos(): IDataObject {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: "1. テストリポ | テスト説明" }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiTranslateRepos() }];
}
