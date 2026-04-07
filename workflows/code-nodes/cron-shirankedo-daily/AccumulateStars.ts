export default function (): CodeNodeReturn {
  // 各バッチのGraphQL結果からstar数をstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global");
  // 初回バッチで明示クリア（前回失敗時のゴミデータ防止）
  if (!staticData._starsInitialized || !staticData.stars) {
    staticData.stars = [];
    staticData.renames = [];
    staticData._starsInitialized = true;
  }
  const data =
    ($input.first().json.data as IDataObject) || $input.first().json || {};
  const repoMap = ($input.first().json.repoMap || {}) as Record<string, string>;
  for (const key of Object.keys(data)) {
    const repo = data[key] as IDataObject | null;
    if (!repo || !repo.nameWithOwner) continue;
    (staticData.stars as IDataObject[]).push({
      repo: repo.nameWithOwner,
      stars: repo.stargazerCount,
    });
    // rename検知: repoMapに元の名前があれば比較
    const originalName = repoMap[key];
    if (originalName && originalName !== repo.nameWithOwner) {
      (staticData.renames as IDataObject[]).push({
        from: originalName,
        to: repo.nameWithOwner,
      });
    }
  }
  return $input.all();
}
