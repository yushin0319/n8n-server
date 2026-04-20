import { mockOpenRouterResponse } from "../_shared/openrouter";

/**
 * 分類ノードのモック.
 * テストモード時に外部APIを呼ばず、全メールを「確認」に分類したレスポンスを返す。
 */
export function mockClassify(emails: IDataObject[]): IDataObject {
  const classifications = emails.map((_, i) => ({
    index: i + 1,
    importance: "確認",
  }));
  return mockOpenRouterResponse(JSON.stringify({ classifications }));
}

export default function (): CodeNodeReturn {
  const emails = $("PrepareClassify").first().json.emails as IDataObject[];
  return [{ json: mockClassify(emails) }];
}
