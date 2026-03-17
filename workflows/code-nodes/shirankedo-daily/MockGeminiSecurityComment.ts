/**
 * GeminiSecurityComment のモック.
 * テストモード時にGemini APIを呼ばず、セキュリティ日次コメントを返す。
 * FormatSecurityDaily.ts が期待するGeminiレスポンス形式で返す。
 */
export function mockGeminiSecurityComment(): IDataObject {
  const comment = {
    comment: "テスト用セキュリティコメント",
    vuln_ids: [] as string[],
    release_ids: [] as string[],
  };
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(comment) }],
        },
      },
    ],
  };
}

export default function (): CodeNodeReturn {
  return [{ json: mockGeminiSecurityComment() }];
}
