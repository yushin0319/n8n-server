/** GraphQLリリースノードの型 */
interface ReleaseNode {
  tagName: string;
  isPrerelease: boolean;
  publishedAt: string;
  name: string;
}

/** GraphQLリポジトリレスポンスの型 */
interface RepoResponse {
  nameWithOwner: string;
  releases: { nodes: ReleaseNode[] };
}

export default function (): CodeNodeReturn {
  // 各バッチのGraphQL結果からリリースを抽出してstaticDataに蓄積
  const staticData = $getWorkflowStaticData("global") as IDataObject;
  if (!staticData.releases) staticData.releases = [];
  const releases = staticData.releases as IDataObject[];

  const now = new Date();
  const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const data =
    ($input.first().json.data as Record<string, RepoResponse>) ||
    ($input.first().json as Record<string, RepoResponse>) ||
    {};

  for (const key of Object.keys(data)) {
    const repo = data[key];
    if (!repo || !repo.releases) continue;
    const repoName = repo.nameWithOwner;
    for (const rel of repo.releases.nodes) {
      if (rel.isPrerelease) continue;
      if (!rel.publishedAt || rel.publishedAt < cutoff) continue;

      const tag = rel.tagName;
      // モノレポのスコープ付きタグ (xxx@1.0.0) からバージョン部分を取得
      const rawVer = tag.includes("@") ? tag.split("@").pop()! : tag;
      const version = rawVer.replace(/^v/, "");
      const parts = version.split(".");

      let type: string | null = null;
      if (parts.length >= 3) {
        const [maj, min, pat] = parts.map((p) => parseInt(p));
        if (!isNaN(maj) && !isNaN(min) && !isNaN(pat)) {
          if (min === 0 && pat === 0) type = "major";
          else if (pat === 0) type = "minor";
        }
      } else if (parts.length === 2) {
        if (!isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1])))
          type = "minor";
      }
      if (!type) continue;

      releases.push({
        repo: repoName,
        tag,
        version,
        type,
        publishedAt: rel.publishedAt.substring(0, 10),
      });
    }
  }
  return $input.all();
}
