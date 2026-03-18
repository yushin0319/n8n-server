import { mockGeminiResponse } from "../_shared/gemini";

/**
 * GeminiClassify のモック.
 * テストモード時にGemini APIを呼ばず、全メールを「確認」に分類したレスポンスを返す。
 */
export function mockGeminiClassify(emails: IDataObject[]): IDataObject {
  const classifications = emails.map((_, i) => ({
    index: i + 1,
    importance: "確認",
  }));
  return mockGeminiResponse(JSON.stringify(classifications));
}

export default function (): CodeNodeReturn {
  const emails = $("PrepareClassify").first().json.emails as IDataObject[];
  return [{ json: mockGeminiClassify(emails) }];
}
