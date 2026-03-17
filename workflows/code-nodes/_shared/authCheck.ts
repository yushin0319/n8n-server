/**
 * Webhook認証チェック.
 * x-webhook-secret ヘッダーと環境変数を比較し、不一致ならエラーを投げる。
 */
export function authCheck(
  items: INodeExecutionData[],
  secret: string,
): INodeExecutionData[] {
  const headerSecret = items[0]?.json?.headers?.["x-webhook-secret"];
  if (headerSecret !== secret) {
    throw new Error("Forbidden: Invalid webhook secret");
  }
  return items;
}
