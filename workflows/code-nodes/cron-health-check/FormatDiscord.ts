export default function (): CodeNodeReturn {
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return [
    {
      json: {
        embed: {
          title: "HistLink Backend DOWN",
          description: now + " にヘルスチェックが失敗しました。",
          color: 15158332,
        },
      },
    },
  ];
}
