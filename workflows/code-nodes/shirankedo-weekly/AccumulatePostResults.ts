export default function (): CodeNodeReturn {
  // POST結果をstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global");
  if (!staticData.postResults) staticData.postResults = { total: 0, errors: 0 };
  const counter = staticData.postResults as { total: number; errors: number };
  const res = $input.first().json;
  if (res && res.ok) {
    counter.total += (res.inserted as number) || 0;
  } else {
    counter.errors += 1;
  }
  return $input.all();
}
