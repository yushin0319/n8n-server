/**
 * リクエストボディからパラメータを抽出・バリデーションする.
 * 必須フィールドがなければエラーオブジェクトを返す。任意フィールドにはデフォルト値を適用。
 */
export function prepParams(
  body: Record<string, unknown>,
  schema: {
    required?: string[];
    optional?: Record<string, unknown>;
  },
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 必須フィールドのチェック
  for (const field of schema.required ?? []) {
    if (!body[field]) {
      return { _error: true, message: `${field} is required` };
    }
    result[field] = body[field];
  }

  // 任意フィールド（デフォルト値あり）
  for (const [field, defaultValue] of Object.entries(schema.optional ?? {})) {
    result[field] = body[field] ?? defaultValue;
  }

  return result;
}
