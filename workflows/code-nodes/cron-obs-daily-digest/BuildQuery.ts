// 観測性 DB (Notion)。api-obs-notify/PrepNotify.ts が書き込む先と同じ。
// _shared に置くと全 WF 再デプロイになるため定数を複製している。
const OBS_DB_ID = "3552570f-e49f-80a6-9186-c1a14b7d9547";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 観測性 DB から日次まとめの対象を引く Notion query を組み立てる。
 * 対象: 直近 24h の critical / warning と、crypto-ai-trader の info（= 約定）。
 * ネストを 1 段に抑えるため timestamp 条件は各 and 節に入れる。
 */
export default function (): CodeNodeReturn {
  const since = {
    property: "timestamp",
    date: { on_or_after: new Date(Date.now() - WINDOW_MS).toISOString() },
  };
  const severityIs = (name: string) => ({
    property: "severity",
    select: { equals: name },
  });

  const requestBody = {
    filter: {
      or: [
        { and: [since, severityIs("critical")] },
        { and: [since, severityIs("warning")] },
        {
          and: [
            since,
            severityIs("info"),
            // crypto-ai-trader が info で送るのは約定 (notify_fill) だけ
            { property: "service", select: { equals: "crypto-ai-trader" } },
          ],
        },
      ],
    },
    sorts: [{ property: "timestamp", direction: "ascending" }],
    page_size: 100,
  };

  return [
    {
      json: {
        url: `https://api.notion.com/v1/databases/${OBS_DB_ID}/query`,
        requestBody: JSON.stringify(requestBody),
      },
    },
  ];
}
