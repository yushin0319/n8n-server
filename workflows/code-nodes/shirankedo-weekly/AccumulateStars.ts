export default function (): CodeNodeReturn {
  // 各バッチのGraphQL結果からstar数をstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global");
  if (!staticData.stars) staticData.stars = [];
  const data =
    ($input.first().json.data as IDataObject) || $input.first().json || {};
  for (const key of Object.keys(data)) {
    const repo = data[key] as IDataObject | null;
    if (!repo || !repo.nameWithOwner) continue;
    (staticData.stars as IDataObject[]).push({
      repo: repo.nameWithOwner,
      stars: repo.stargazerCount,
    });
  }
  return $input.all();
}
