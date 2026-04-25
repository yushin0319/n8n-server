interface WfStat {
  name: string;
  count: number;
  errors: number;
}

interface ErrorWfStat {
  name: string;
  count: number;
  errors: number;
}

interface RecentError {
  wfName: string;
  id: string;
  startedAt: string;
}

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export default function (): CodeNodeReturn {
  const stats = $input.first().json as IDataObject;
  const errorRate = (stats.errorRatePct as number) ?? 0;
  const total = (stats.total as number) ?? 0;
  const errorCount = (stats.error as number) ?? 0;

  // 緑: 正常 / 黄: 警告 (>1%) / 赤: 異常 (>5%)
  let color = 0x2ecc71;
  if (errorRate > 5) color = 0xe74c3c;
  else if (errorRate > 1) color = 0xf1c40f;

  const fields: DiscordField[] = [];
  fields.push({
    name: "Status",
    value: `成功 ${stats.success} / 失敗 ${errorCount} / 待機 ${stats.waiting}`,
    inline: true,
  });
  fields.push({
    name: "Error Rate",
    value: `${errorRate}%`,
    inline: true,
  });
  fields.push({
    name: "Avg Duration",
    value: `${stats.avgDurationSec}s`,
    inline: true,
  });

  const topByCount = (stats.topByCount as WfStat[]) || [];
  if (topByCount.length > 0) {
    const lines = topByCount.map(
      (w) =>
        `• ${w.name}: ${w.count}${w.errors > 0 ? ` (err ${w.errors})` : ""}`,
    );
    fields.push({ name: "Top WFs (by count)", value: lines.join("\n") });
  }

  const topByErrors = (stats.topByErrors as ErrorWfStat[]) || [];
  if (topByErrors.length > 0) {
    const lines = topByErrors.map(
      (w) => `• ${w.name}: ${w.errors} / ${w.count}`,
    );
    fields.push({ name: "Errors by WF", value: lines.join("\n") });
  }

  const recentErrors = (stats.recentErrors as RecentError[]) || [];
  if (recentErrors.length > 0) {
    const lines = recentErrors.map(
      (e) =>
        `• [${e.id}] ${e.wfName} @ ${(e.startedAt || "").slice(0, 19).replace("T", " ")}`,
    );
    fields.push({ name: "Recent Errors", value: lines.join("\n") });
  }

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const coverageHours = stats.coverageHours;

  return [
    {
      json: {
        embed: {
          title: "📊 n8n Daily Metrics Summary",
          description: `${now} 時点・直近 ${total} 件の実行（カバー期間 約 ${coverageHours} 時間）`,
          color,
          fields,
          footer: {
            text: `coverage: ${stats.coverageFrom} → ${stats.coverageTo}`,
          },
        },
      },
    },
  ];
}
