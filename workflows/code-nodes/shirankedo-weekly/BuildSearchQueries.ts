export default function (): CodeNodeReturn {
  // 5ティアのGitHub Search APIクエリを構築
  const now = new Date();
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  const ago = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return fmt(d);
  };

  const tiers = [
    { q: "stars:>50000", label: "Tier1: ★50k+" },
    { q: `stars:10000..50000 pushed:>${ago(365)}`, label: "Tier2: 1yr ★10k+" },
    { q: `stars:5000..10000 pushed:>${ago(180)}`, label: "Tier3: 6mo ★5k+" },
    { q: `stars:2000..5000 pushed:>${ago(90)}`, label: "Tier4: 3mo ★2k+" },
    { q: `stars:1000..2000 pushed:>${ago(30)}`, label: "Tier5: 1mo ★1k+" },
  ];

  // 各ティアを2ページずつ（最大200件/ティア）
  const queries: INodeExecutionData[] = [];
  for (const tier of tiers) {
    for (let page = 1; page <= 2; page++) {
      queries.push({
        json: {
          url: `https://api.github.com/search/repositories?q=${encodeURIComponent(tier.q)}&sort=stars&order=desc&per_page=100&page=${page}`,
          label: tier.label,
          page,
        },
      });
    }
  }
  return queries;
}
