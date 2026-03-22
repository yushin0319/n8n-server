/**
 * Gemini API リクエスト/レスポンスのユーティリティ.
 */

/** Gemini APIリクエストボディを生成する */
export function buildGeminiRequest(params: {
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
  maxOutputTokens?: number;
  thinkingBudget?: number;
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
    (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
