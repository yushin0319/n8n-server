import { parseClassifications } from "../_shared/parseClassifications";

/**
 * classify ノードの HTTP レスポンスから classifications 配列を抽出・検証する.
 *
 * 成功時: `{ classifications: [{index, importance}, ...] }` を返す.
 * 失敗時: 例外を投げ、`onError: continueErrorOutput` 経由で次段 classify
 * にフォールバックする. LLM が HTTP 200 でも壊れた JSON を返すケースを
 * ここで検知する.
 */
export default function (): CodeNodeReturn {
  const response = $input.first().json;
  const classifications = parseClassifications(response);
  return [{ json: { classifications } }];
}
