/**
 * 分類ノードのモック.
 * テストモード時に外部APIを呼ばず、全メールを「確認」に分類した
 * `{ classifications: [...] }` 形式のデータを直接返す
 * （ValidateClassify と同じ形で BuildNotionBody に渡す）.
 */
export function mockClassify(emails: IDataObject[]): {
  classifications: { index: number; importance: string }[];
} {
  return {
    classifications: emails.map((_, i) => ({
      index: i + 1,
      importance: "確認",
    })),
  };
}

export default function (): CodeNodeReturn {
  const emails = $("PrepareClassify").first().json.emails as IDataObject[];
  return [{ json: mockClassify(emails) }];
}
