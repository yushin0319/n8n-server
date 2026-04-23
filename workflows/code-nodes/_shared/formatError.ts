/**
 * エラーオブジェクトを Discord 通知向けの短い要約文字列に整形する。
 * スタックトレースや巨大な JSON を含めず、status / code / message を優先的に拾う。
 * Discord のメッセージ 2000 字制限に収めるため、maxLen で切り詰める。
 */
export function formatError(error: unknown, maxLen = 300): string {
  if (error == null) return "unknown";
  if (typeof error === "string") return clip(error, maxLen);
  if (typeof error !== "object") return clip(String(error), maxLen);

  const e = error as Record<string, unknown>;
  const status = e.status ?? e.statusCode;
  const code = typeof e.code === "string" ? e.code : "";
  const message =
    (typeof e.message === "string" && e.message) ||
    (typeof e.error === "string" && e.error) ||
    "";

  const header = [typeof status === "number" ? String(status) : "", code]
    .filter(Boolean)
    .join(" ");

  const body = message || safeJsonSummary(e);
  const joined = header ? (body ? `${header}: ${body}` : header) : body;
  return clip(joined || "unknown", maxLen);
}

function safeJsonSummary(e: Record<string, unknown>): string {
  const { stack: _stack, ...rest } = e;
  try {
    return JSON.stringify(rest);
  } catch {
    return "unserializable";
  }
}

function clip(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
