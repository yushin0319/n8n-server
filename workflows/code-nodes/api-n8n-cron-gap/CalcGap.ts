interface ExecutionRow {
  id?: string;
  workflowId?: string;
  status?: string;
  startedAt?: string;
}

interface ScheduleInterval {
  field?: string;
  minutesInterval?: number;
  hoursInterval?: number;
  triggerAtHour?: number;
  triggerAtMinute?: number;
  triggerAtDayOfWeek?: number;
}

interface NodeRow {
  type?: string;
  parameters?: { rule?: { interval?: ScheduleInterval[] } };
}

interface WorkflowRow {
  id?: string;
  name?: string;
  active?: boolean;
  nodes?: NodeRow[];
}

export interface PerWfGap {
  workflowId: string;
  name: string;
  expectedIntervalMin: number | null;
  executionCount: number;
  maxGapMin: number | null;
  coverageMin: number;
  oldestStarted: string | null;
  newestStarted: string | null;
  skipWarning: boolean;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

function calcExpectedIntervalMin(wf: WorkflowRow): number | null {
  const sched = (wf.nodes || []).find(
    (n) => n.type === "n8n-nodes-base.scheduleTrigger",
  );
  const interval = sched?.parameters?.rule?.interval?.[0];
  if (!interval) return null;
  switch (interval.field) {
    case "minutes":
      return Number(interval.minutesInterval) || null;
    case "hours":
      return (Number(interval.hoursInterval) || 1) * 60;
    case "days":
      return 1440;
    case "weeks":
      return 10080;
    case "months":
      // 30 日換算（厳密でなくてよい。skip 判定の閾値計算用）
      return 43200;
    default:
      // cronExpression は未対応（現状 cron WF では未使用）
      return null;
  }
}

export default function (): CodeNodeReturn {
  const wfResp = $("FetchWorkflows").first().json as IDataObject;
  const execResp = $input.first().json as IDataObject;
  const workflows = (wfResp?.data || []) as WorkflowRow[];
  const executions = (execResp?.data || []) as ExecutionRow[];

  // cron WF のみ抽出（name が "cron/" で始まる）
  const cronWfs = workflows.filter((w) => (w.name || "").startsWith("cron/"));

  // executions を workflowId 別に group by + 全体カバレッジを 1 パスで集計
  const execsByWf: Record<string, ExecutionRow[]> = {};
  let allOldest: Date | null = null;
  let allNewest: Date | null = null;
  for (const ex of executions) {
    if (!ex.startedAt) continue;
    const d = new Date(ex.startedAt);
    if (!allOldest || d < allOldest) allOldest = d;
    if (!allNewest || d > allNewest) allNewest = d;
    if (!ex.workflowId) continue;
    const arr = execsByWf[ex.workflowId] || (execsByWf[ex.workflowId] = []);
    arr.push(ex);
  }
  for (const id in execsByWf) {
    execsByWf[id].sort(
      (a, b) =>
        new Date(a.startedAt as string).getTime() -
        new Date(b.startedAt as string).getTime(),
    );
  }
  const coverageHours =
    allOldest && allNewest
      ? (allNewest.getTime() - allOldest.getTime()) / 3_600_000
      : 0;

  const results: PerWfGap[] = [];
  for (const wf of cronWfs) {
    if (!wf.id) continue;
    const expectedIntervalMin = calcExpectedIntervalMin(wf);
    const exs = execsByWf[wf.id] || [];

    let maxGapMin: number | null = null;
    let coverageMin = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    if (exs.length > 0) {
      oldest = exs[0].startedAt as string;
      newest = exs[exs.length - 1].startedAt as string;
      coverageMin =
        (new Date(newest).getTime() - new Date(oldest).getTime()) / 60_000;

      if (exs.length >= 2) {
        let max = 0;
        for (let i = 1; i < exs.length; i++) {
          const gap =
            (new Date(exs[i].startedAt as string).getTime() -
              new Date(exs[i - 1].startedAt as string).getTime()) /
            60_000;
          if (gap > max) max = gap;
        }
        maxGapMin = round1(max);
      }
    }

    const skipWarning =
      expectedIntervalMin !== null &&
      maxGapMin !== null &&
      maxGapMin > expectedIntervalMin * 2;

    results.push({
      workflowId: wf.id,
      name: wf.name || wf.id,
      expectedIntervalMin,
      executionCount: exs.length,
      maxGapMin,
      coverageMin: round1(coverageMin),
      oldestStarted: oldest,
      newestStarted: newest,
      skipWarning,
    });
  }

  // skipWarning を先頭に、その後は名前昇順
  results.sort((a, b) => {
    if (a.skipWarning !== b.skipWarning) return a.skipWarning ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const warnings = results.filter((r) => r.skipWarning);

  return [
    {
      json: {
        coverageHours: round1(coverageHours),
        coverageFrom: allOldest ? allOldest.toISOString() : null,
        coverageTo: allNewest ? allNewest.toISOString() : null,
        totalExecutions: executions.length,
        cronWorkflowCount: cronWfs.length,
        warnings,
        workflows: results,
      },
    },
  ];
}
