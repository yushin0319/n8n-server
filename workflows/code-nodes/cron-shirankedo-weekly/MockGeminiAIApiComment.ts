import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiAIApiComment のモック.
 * テストモード時にGemini APIを呼ばず、AI APIコメントを返す。
 * FormatAIApiComment.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiAIApiComment(): IDataObject {
  return mockGeminiResponse("テスト用AI APIコメント");
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiAIApiComment() }];
}
