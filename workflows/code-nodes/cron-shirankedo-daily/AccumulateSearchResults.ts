export default function (): CodeNodeReturn {
  // 検索結果をstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global");
  // 初回バッチで明示クリア（前回失敗時のゴミデータ防止）
  if (!staticData._searchInitialized || !staticData.searchRepos) {
    staticData.searchRepos = [];
    staticData._searchInitialized = true;
  }
  const items = ($input.first().json.items || []) as IDataObject[];
  for (const r of items) {
    (staticData.searchRepos as IDataObject[]).push({
      repo: r.full_name,
      name: r.name,
      description: (r.description as string) || "",
      language: (r.language as string) || "",
      stars: r.stargazers_count,
    });
  }
  return $input.all();
}
