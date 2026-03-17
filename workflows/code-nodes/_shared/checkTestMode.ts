/**
 * テストモード判定.
 * Webhook bodyの test:true を検出し、$execution.customData に isTest フラグをセットする。
 * Schedule経由の場合は body が存在しないため isTest='false' になる。
 */
export function checkTestMode(
  items: INodeExecutionData[],
  execution: IExecutionData,
): INodeExecutionData[] {
  const body = items[0]?.json?.body;
  const isTest = body?.test === true;
  execution.customData.set("isTest", isTest ? "true" : "false");
  return items;
}
