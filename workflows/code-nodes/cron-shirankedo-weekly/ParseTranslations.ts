export default function (): CodeNodeReturn {
  // staticDataから翻訳結果を読み出し、star情報も保持
  const staticData = $getWorkflowStaticData("global");
  const repos = (staticData.translations || []) as IDataObject[];
  staticData.translations = [];

  if (repos.length === 0) {
    return [{ json: { requestBody: "[]", count: 0 } }];
  }

  // 新規リポのstar情報をstaticDataに保存（後でrepo-statsにPOST）
  staticData.newRepoStars = repos.map((r: IDataObject) => ({
    repo: r.repo,
    stars: (r.stars as number) || 0,
  }));

  // 50件チャンクに分割
  const chunks: IDataObject[][] = [];
  for (let i = 0; i < repos.length; i += 50) {
    chunks.push(repos.slice(i, i + 50));
  }

  return chunks.map((chunk, idx) => ({
    json: {
      requestBody: JSON.stringify(chunk),
      count: chunk.length,
      chunkIndex: idx,
      totalRepos: repos.length,
    },
  }));
}
