/**
 * Gemini API リクエスト/レスポンスのユーティリティ.
 */

interface GeminiResponseShape {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** Gemini APIリクエストボディを生成する。
 *
 * responseJsonSchema は Gemini 3 系のみ対応 (gemini-3-flash-preview / gemini-3.1-pro-preview)。
 * 2.5-flash 等で指定すると 400 になるため呼び出し側で model を確認して渡すこと。
 * required 配列で必須フィールドを明示すると Gemini がフィールド欠落を防いで返す。
 */
export function buildGeminiRequest(params: {
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  responseJsonSchema?: Record<string, unknown>;
}): string {
  const config: Record<string, unknown> = {
    temperature: params.temperature ?? 0.3,
    responseMimeType: params.responseMimeType ?? "application/json",
  };
  if (params.maxOutputTokens) {
    config.maxOutputTokens = params.maxOutputTokens;
  }
  if (params.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: params.thinkingBudget };
  }
  if (params.responseJsonSchema) {
    config.responseJsonSchema = params.responseJsonSchema;
  }

  return JSON.stringify({
    contents: [{ parts: [{ text: params.prompt }] }],
    generationConfig: config,
  });
}

/** Geminiレスポンスからプレーンテキストを取得する（JSONパースしない） */
export function parseGeminiText(
  response: IDataObject,
  fallback?: string,
): string {
  const text =
    (response as GeminiResponseShape)?.candidates?.[0]?.content?.parts?.[0]
      ?.text || "";
  return text || (fallback ?? "");
}

/** Geminiモックレスポンスを生成する */
export function mockGeminiResponse(text: string): IDataObject {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  } as unknown as IDataObject;
}

/** Geminiレスポンスからテキストを取得してJSONパースする */
export function parseGeminiJson<T = unknown>(response: IDataObject): T {
  const text =
    (response as GeminiResponseShape)?.candidates?.[0]?.content?.parts?.[0]
      ?.text || "";
  if (!text) {
    throw new Error("Geminiレスポンスが空です");
  }
  try {
    return JSON.parse(text as string);
  } catch {
    const preview = (text as string).substring(0, 300);
    throw new Error(`JSONパース失敗: ${preview}`);
  }
}
