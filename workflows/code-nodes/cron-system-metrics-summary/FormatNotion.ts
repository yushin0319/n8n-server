interface WfStat {
  name: string;
  count: number;
  errors: number;
}

interface RecentError {
  wfName: string;
  id: string;
  startedAt: string;
}

export default function (): CodeNodeReturn {
  const stats = $input.first().json as IDataObject;

  const date = new Date().toISOString().slice(0, 10);

  const topWfStr = ((stats.topByCount as WfStat[]) || [])
    .map(
      (w) => `${w.name}: ${w.count}${w.errors > 0 ? ` (err ${w.errors})` : ""}`,
    )
    .join("\n");

  const recentErrorsStr = ((stats.recentErrors as RecentError[]) || [])
    .map(
      (e) =>
        `[${e.id}] ${e.wfName} @ ${(e.startedAt || "").slice(0, 19).replace("T", " ")}`,
    )
    .join("\n");

  return [
    {
      json: {
        action: "create",
        date,
        total: stats.total,
        success: stats.success,
        error: stats.error,
        waiting: stats.waiting,
        error_rate_pct: stats.errorRatePct,
        avg_duration_sec: stats.avgDurationSec,
        coverage_hours: stats.coverageHours,
        top_wf: topWfStr,
        recent_errors: recentErrorsStr,
      },
    },
  ];
}
