export default function (): CodeNodeReturn {
  // POST結果をstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global");
  // 初回バッチで明示クリア（前回失敗時のゴミデータ防止）
  if (!staticData._postInitialized) {
    staticData.postResults = { total: 0, errors: 0 };
    staticData._postInitialized = true;
  }
  const counter = staticData.postResults as { total: number; errors: number };
  const res = $input.first()?.json;
  if (!res) {
    counter.errors += 1;
  } else if (res.ok) {
    counter.total += (res.inserted as number) || 0;
  } else {
    counter.errors += 1;
  }
  return $input.all();
}
