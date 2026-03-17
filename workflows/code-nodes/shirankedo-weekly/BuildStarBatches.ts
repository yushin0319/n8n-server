export default function (): CodeNodeReturn {
  // tracking-reposからstar取得用GraphQLバッチを構築（50リポ/バッチ）
  const repos = ($input.first().json.data || []) as IDataObject[];
  if (!repos.length) return [{ json: { batches: [], count: 0 } }];

  const batchSize = 50;
  const batches: INodeExecutionData[] = [];
  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    const parts = batch.map((r: IDataObject, idx: number) => {
      const [owner, name] = (r.repo as string).split("/");
      return `r${i + idx}: repository(owner: "${owner}", name: "${name}") { nameWithOwner stargazerCount }`;
    });
    batches.push({
      json: { query: `{${parts.join(" ")}}`, batchIndex: batches.length },
    });
  }
  return batches;
}
