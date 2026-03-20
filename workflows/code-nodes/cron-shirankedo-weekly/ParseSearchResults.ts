export default function (): CodeNodeReturn {
  // staticDataから検索結果を読み出し、フィルタ・既存除外
  const staticData = $getWorkflowStaticData("global");
  const allRepos = (staticData.searchRepos || []) as IDataObject[];
  staticData.searchRepos = [];

  // 既存リポ一覧
  const existingRepos = ($("FetchExistingRepos").first().json.data ||
    []) as IDataObject[];
  const existingSet = new Set(
    existingRepos.map((r: IDataObject) => (r.repo as string).toLowerCase()),
  );

  // ブロックリスト
  const blocklist = [
    "awesome",
    "interview",
    "free-programming-books",
    "build-your-own",
    "public-apis",
    "developer-roadmap",
    "system-design",
    "cheatsheet",
    "learn-",
    "tutorial",
    "roadmap",
    "study-plan",
    "coding-guide",
    "freeCodeCamp",
    "computer-science",
    "project-based-learning",
    "the-art-of-command-line",
    "the-book-of-secret-knowledge",
  ];

  // デデュプ（repo名で）
  const seen = new Set<string>();
  const deduped: IDataObject[] = [];
  for (const r of allRepos) {
    const key = (r.repo as string).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // フィルタ: 言語あり + ブロックリスト除外 + 既存除外
  const newRepos = deduped.filter((r: IDataObject) => {
    if (!r.language) return false;
    const name = (r.repo as string).toLowerCase();
    if (blocklist.some((kw) => name.includes(kw))) return false;
    if (existingSet.has(name)) return false;
    return true;
  });

  if (newRepos.length === 0) {
    return [{ json: { hasNewRepos: false, count: 0 } }];
  }

  // Gemini翻訳用にバッチ化（20件ずつ）
  const batchSize = 20;
  const batches: IDataObject[][] = [];
  for (let i = 0; i < newRepos.length; i += batchSize) {
    batches.push(newRepos.slice(i, i + batchSize));
  }

  return [
    {
      json: {
        hasNewRepos: true,
        count: newRepos.length,
        batches,
        totalBatches: batches.length,
      },
    },
  ];
}
