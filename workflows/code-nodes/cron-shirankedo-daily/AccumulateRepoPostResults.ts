export default function (): CodeNodeReturn {
  const staticData = $getWorkflowStaticData("global");
  // 初回バッチで明示クリア（前回失敗時のゴミデータ防止）
  if (!staticData._repoPostInitialized || !staticData.repoPostResults) {
    staticData.repoPostResults = { total: 0, errors: 0 };
    staticData._repoPostInitialized = true;
  }
  const counter = staticData.repoPostResults as {
    total: number;
    errors: number;
  };
  const res = $input.first().json;
  if (res?.ok) {
    counter.total += (res.inserted as number) || 0;
  } else {
    counter.errors += 1;
  }
  return $input.all();
}
