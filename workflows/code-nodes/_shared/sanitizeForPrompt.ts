/**
 * 外部入力テキストをAIプロンプトに埋め込む前にサニタイズする。
 * - 改行・制御文字を除去（プロンプト構造の破壊を防ぐ）
 * - 指示っぽいパターンをエスケープ（"Ignore above instructions" 等）
 * - 長さ制限（デフォルト500文字）
 */
export function sanitizeForPrompt(
  text: string,
  maxLength: number = 500,
): string {
  if (!text || typeof text !== "string") return "";

  return (
    text
      // 改行・制御文字をスペースに置換
      // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字の除去が目的
      .replace(/[\n\r\t\x00-\x1f]/g, " ")
      // 連続スペースを1つに
      .replace(/\s{2,}/g, " ")
      .trim()
      .substring(0, maxLength)
  );
}
