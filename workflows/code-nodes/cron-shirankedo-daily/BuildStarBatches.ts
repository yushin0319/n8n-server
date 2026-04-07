import { sanitizeGitHubName as safe } from "../_shared/sanitizeGitHubName";

export default function (): CodeNodeReturn {
  // tracking-reposからstar取得用GraphQLバッチを構築（50リポ/バッチ）
  const repos = ($input.first().json.data || []) as IDataObject[];
  if (!repos.length) return [{ json: { batches: [], count: 0 } }];

  const batchSize = 50;
  const batches: INodeExecutionData[] = [];
  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    const repoMap: Record<string, string> = {};
    const parts = batch.map((r: IDataObject, idx: number) => {
      const alias = `r${i + idx}`;
      const repoName = r.repo as string;
      const [owner, name] = repoName.split("/");
      repoMap[alias] = repoName;
      return `${alias}: repository(owner: "${safe(owner)}", name: "${safe(name)}") { nameWithOwner stargazerCount }`;
    });
    batches.push({
      json: {
        query: `{${parts.join(" ")}}`,
        repoMap,
        batchIndex: batches.length,
      },
    });
  }
  return batches;
}
