/**
 * GeminiAISubComment のモック.
 * テストモード時にGemini APIを呼ばず、AIサブスクリプションコメントを返す。
 * FormatPageComments.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiAISubComment(): IDataObject {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: "テスト用AIサブスクリプションコメント" }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiAISubComment() }];
}
