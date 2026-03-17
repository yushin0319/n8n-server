/**
 * GeminiTrendComment のモック.
 * テストモード時にGemini APIを呼ばず、トレンドコメントを返す。
 * FormatTrendComment.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiTrendComment(): IDataObject {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: "テスト用トレンドコメント" }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiTrendComment() }];
}
