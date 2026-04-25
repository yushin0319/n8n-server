interface ExecutionRow {
  id?: string;
  workflowId?: string;
  status?: string;
  startedAt?: string;
  stoppedAt?: string;
}

interface WorkflowRow {
  id?: string;
  name?: string;
}

interface PerWfStats {
  count: number;
  errors: number;
  durations: number[];
}

export default function (): CodeNodeReturn {
  const execResp = $("FetchExecutions").first().json as IDataObject;
  const wfResp = $input.first().json as IDataObject;
  const executions = (execResp?.data || []) as ExecutionRow[];
  const workflows = (wfResp?.data || []) as WorkflowRow[];

  const wfMap: Record<string, string> = {};
  for (const w of workflows) {
    if (w.id) wfMap[w.id] = w.name || w.id;
  }

  let oldestStarted: Date | null = null;
  let newestStarted: Date | null = null;
  for (const ex of executions) {
    if (!ex.startedAt) continue;
    const d = new Date(ex.startedAt);
    if (!oldestStarted || d < oldestStarted) oldestStarted = d;
    if (!newestStarted || d > newestStarted) newestStarted = d;
  }
  const coverageHours =
    oldestStarted && newestStarted
      ? (newestStarted.getTime() - oldestStarted.getTime()) / 3_600_000
      : 0;

  let total = 0;
  let success = 0;
  let errorCount = 0;
  let waiting = 0;
  let other = 0;
  let durationSum = 0;
  let durationCount = 0;
  const perWf: Record<string, PerWfStats> = {};
  const recentErrors: { wfName: string; id: string; startedAt: string }[] = [];

  for (const ex of executions) {
    total += 1;
    const wfId = ex.workflowId || "unknown";
    const wfName = wfMap[wfId] || wfId;
    if (!perWf[wfName]) {
      perWf[wfName] = { count: 0, errors: 0, durations: [] };
    }
    perWf[wfName].count += 1;

    const status = ex.status || "unknown";
    if (status === "success") {
      success += 1;
    } else if (
      status === "error" ||
      status === "crashed" ||
      status === "canceled"
    ) {
      errorCount += 1;
      perWf[wfName].errors += 1;
      if (recentErrors.length < 5) {
        recentErrors.push({
          wfName,
          id: ex.id || "?",
          startedAt: ex.startedAt || "",
        });
      }
    } else if (
      status === "waiting" ||
      status === "running" ||
      status === "new"
    ) {
      waiting += 1;
    } else {
      other += 1;
    }

    if (ex.startedAt && ex.stoppedAt) {
      const dur =
        (new Date(ex.stoppedAt).getTime() - new Date(ex.startedAt).getTime()) /
        1000;
      if (dur >= 0) {
        durationSum += dur;
        durationCount += 1;
        perWf[wfName].durations.push(dur);
      }
    }
  }

  const avgDurationSec = durationCount > 0 ? durationSum / durationCount : 0;

  const topByCount = Object.entries(perWf)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, s]) => ({ name, count: s.count, errors: s.errors }));

  const topByErrors = Object.entries(perWf)
    .filter(([, s]) => s.errors > 0)
    .sort((a, b) => b[1].errors - a[1].errors)
    .slice(0, 5)
    .map(([name, s]) => ({ name, errors: s.errors, count: s.count }));

  return [
    {
      json: {
        total,
        success,
        error: errorCount,
        waiting,
        other,
        avgDurationSec: Math.round(avgDurationSec * 100) / 100,
        coverageHours: Math.round(coverageHours * 10) / 10,
        coverageFrom: oldestStarted?.toISOString() || null,
        coverageTo: newestStarted?.toISOString() || null,
        errorRatePct:
          total > 0 ? Math.round((errorCount / total) * 1000) / 10 : 0,
        topByCount,
        topByErrors,
        recentErrors,
      },
    },
  ];
}
