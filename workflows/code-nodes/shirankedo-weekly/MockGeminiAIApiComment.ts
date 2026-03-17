/**
 * GeminiAIApiComment のモック.
 * テストモード時にGemini APIを呼ばず、AI APIコメントを返す。
 * FormatAIApiComment.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiAIApiComment(): IDataObject {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: "テスト用AI APIコメント" }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiAIApiComment() }];
}
