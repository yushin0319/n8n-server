import { parseGeminiText } from "./gemini";
import { parseOpenRouterText } from "./openrouter";

/**
 * OpenRouter/Gemini の classify レスポンスから
 * `{index, importance}` 配列を取り出す.
 *
 * LLM の JSON 破損（キー欠落・引用符混在）を検出するため、
 * 取り出した各要素が `index:number` と `importance:string` を
 * 持つか厳密に検証し、欠落時は例外を投げる（ValidateClassify が
 * continueErrorOutput で拾い、次段 classify にフォールバックする前提）.
 */
export function parseClassifications(response: IDataObject): IDataObject[] {
  const responseText =
    parseOpenRouterText(response) || parseGeminiText(response);
  if (!responseText) {
    throw new Error("parseClassifications: レスポンステキストが空");
  }

  let classifications: IDataObject[] | null = null;

  try {
    const parsed: unknown = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      classifications = parsed as IDataObject[];
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "classifications" in parsed &&
      Array.isArray((parsed as { classifications: unknown }).classifications)
    ) {
      classifications = (parsed as { classifications: IDataObject[] })
        .classifications;
    }
  } catch (_e) {
    // JSON全体のパース失敗時、配列っぽい部分を抽出してリトライ
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        classifications = JSON.parse(jsonMatch[0]);
      } catch {
        // fallthrough
      }
    }
  }

  if (!classifications || !Array.isArray(classifications)) {
    throw new Error(
      `parseClassifications: 配列を抽出できませんでした: ${responseText.substring(0, 200)}`,
    );
  }

  for (const c of classifications) {
    if (c == null || typeof c !== "object") {
      throw new Error(
        `parseClassifications: 要素がオブジェクトでない: ${JSON.stringify(c).substring(0, 200)}`,
      );
    }
    if (typeof c.index !== "number") {
      throw new Error(
        `parseClassifications: index が number でない: ${JSON.stringify(c).substring(0, 200)}`,
      );
    }
    if (typeof c.importance !== "string" || !c.importance) {
      throw new Error(
        `parseClassifications: importance が非空 string でない: ${JSON.stringify(c).substring(0, 200)}`,
      );
    }
  }

  return classifications;
}
