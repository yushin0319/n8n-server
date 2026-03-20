import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiWeeklyReport のモック.
 * テストモード時にGemini APIを呼ばず、週次レポートを返す。
 * FormatWeeklyReport.ts が期待するGeminiレスポンス形式（プレーンテキスト）で返す。
 */
export function mockGeminiWeeklyReport(): IDataObject {
  return mockGeminiResponse("テスト用週次レポート内容");
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiWeeklyReport() }];
}
