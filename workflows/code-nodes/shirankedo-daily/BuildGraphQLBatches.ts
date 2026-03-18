export default function (): CodeNodeReturn {
  // tracking-reposからGraphQLバッチクエリを構築（40リポ/バッチ）
  const response = $input.first().json;
  const repos = response.data || response || [];
  const repoList: string[] = Array.isArray(repos)
    ? repos.map((r: IDataObject) =>
        typeof r === "string" ? r : (r.repo as string) || "",
      )
    : [];
  const valid = repoList.filter((r) => r && r.includes("/"));

  if (valid.length === 0) {
    return [{ json: { releases: [], count: 0, empty: true } }];
  }

  // GraphQL文字列リテラル用エスケープ
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const BATCH_SIZE = 40;
  const batches: INodeExecutionData[] = [];
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const parts = batch.map((repo, idx) => {
      const [owner, name] = repo.split("/");
      const alias = `r${batchIndex}_${idx}`;
      return `${alias}: repository(owner: "${esc(owner)}", name: "${esc(name)}") { nameWithOwner releases(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { tagName isPrerelease publishedAt name } } }`;
    });
    batches.push({
      json: { query: `{${parts.join(" ")}}`, batchIndex },
    });
  }
  return batches;
}
