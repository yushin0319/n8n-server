/**
 * Discord通知メッセージを生成する.
 * 成功/失敗に応じて絵文字付きのメッセージ文字列を返す。
 */
export function discordMessage(params: {
  label: string;
  isError: boolean;
  detail?: string;
}): string {
  const emoji = params.isError ? "❌" : "✅";
  const suffix = params.detail ? `: ${params.detail}` : "";
  return `${emoji} ${params.label}${suffix}`;
}
