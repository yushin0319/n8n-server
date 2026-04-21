/**
 * OpenRouter API (OpenAI互換) リクエスト/レスポンスのユーティリティ.
 */

interface OpenRouterResponseShape {
  choices?: { message?: { role?: string; content?: string } }[];
}

/** OpenRouter APIリクエストボディを生成する */
export function buildOpenRouterRequest(params: {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): string {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: [{ role: "user", content: params.prompt }],
    temperature: params.temperature ?? 0.3,
  };
  if (params.maxTokens) {
    body.max_tokens = params.maxTokens;
  }
  if (params.jsonMode ?? true) {
    body.response_format = { type: "json_object" };
  }
  return JSON.stringify(body);
}

/** OpenRouterレスポンスからプレーンテキストを取得する */
export function parseOpenRouterText(
  response: IDataObject,
  fallback?: string,
): string {
  const text =
    (response as OpenRouterResponseShape)?.choices?.[0]?.message?.content || "";
  return text || (fallback ?? "");
}

/** OpenRouterモックレスポンスを生成する */
export function mockOpenRouterResponse(text: string): IDataObject {
  return {
    choices: [{ message: { role: "assistant", content: text } }],
  } as IDataObject;
}

/** OpenRouterレスポンスからテキストを取得してJSONパースする */
export function parseOpenRouterJson<T = unknown>(response: IDataObject): T {
  const text =
    (response as OpenRouterResponseShape)?.choices?.[0]?.message?.content || "";
  if (!text) {
    throw new Error("OpenRouterレスポンスが空です");
  }
  try {
    return JSON.parse(text as string);
  } catch {
    const preview = (text as string).substring(0, 300);
    throw new Error(`JSONパース失敗: ${preview}`);
  }
}
