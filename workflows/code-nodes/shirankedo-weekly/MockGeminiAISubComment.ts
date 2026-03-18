import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiAISubComment のモック.
 * テストモード時にGemini APIを呼ばず、AIサブスクリプションコメントを返す。
 * FormatPageComments.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiAISubComment(): IDataObject {
  return mockGeminiResponse("テスト用AIサブスクリプションコメント");
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiAISubComment() }];
}
