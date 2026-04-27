import { describe, expect, it, vi } from "vitest";
import calcGap, { type PerWfGap } from "./CalcGap";

interface CalcGapOutput {
  coverageHours: number;
  coverageFrom: string | null;
  coverageTo: string | null;
  totalExecutions: number;
  cronWorkflowCount: number;
  warnings: PerWfGap[];
  workflows: PerWfGap[];
}

function setup(executions: unknown[], workflows: unknown[]) {
  vi.stubGlobal("$", (name: string) => {
    if (name === "FetchWorkflows") {
      return {
        first: () => ({ json: { data: workflows } }),
      };
    }
    throw new Error(`unexpected $ call: ${name}`);
  });
  vi.stubGlobal("$input", {
    first: () => ({ json: { data: executions } }),
  });
}

function run(): CalcGapOutput {
  const result = calcGap();
  const items = Array.isArray(result) ? result : [result];
  return (items[0] as { json: CalcGapOutput }).json;
}

function makeCronWf(
  id: string,
  name: string,
  intervalParams: Record<string, unknown>,
) {
  return {
    id,
    name,
    nodes: [
      {
        type: "n8n-nodes-base.scheduleTrigger",
        parameters: {
          rule: {
            interval: [intervalParams],
          },
        },
      },
    ],
  };
}

describe("CalcGap", () => {
  it("空入力でも空配列が返る", () => {
    setup([], []);
    const out = run();
    expect(out.totalExecutions).toBe(0);
    expect(out.cronWorkflowCount).toBe(0);
    expect(out.workflows).toEqual([]);
    expect(out.warnings).toEqual([]);
  });

  it("cron/ で始まらない WF は無視する", () => {
    setup(
      [],
      [
        makeCronWf("wf1", "api/notion-tasks", {
          field: "minutes",
          minutesInterval: 5,
        }),
        makeCronWf("wf2", "cron/heartbeat", {
          field: "minutes",
          minutesInterval: 5,
        }),
      ],
    );
    const out = run();
    expect(out.cronWorkflowCount).toBe(1);
    expect(out.workflows[0].name).toBe("cron/heartbeat");
  });

  it("minutes / hours / days / weeks / months の interval を分換算する", () => {
    setup(
      [],
      [
        makeCronWf("a", "cron/a", {
          field: "minutes",
          minutesInterval: 5,
        }),
        makeCronWf("b", "cron/b", { field: "hours", hoursInterval: 2 }),
        makeCronWf("c", "cron/c", {
          field: "days",
          triggerAtHour: 3,
          triggerAtMinute: 0,
        }),
        makeCronWf("d", "cron/d", { field: "weeks", triggerAtDayOfWeek: 1 }),
        makeCronWf("e", "cron/e", { field: "months" }),
      ],
    );
    const out = run();
    const byName = Object.fromEntries(
      out.workflows.map((w) => [w.name, w.expectedIntervalMin]),
    );
    expect(byName["cron/a"]).toBe(5);
    expect(byName["cron/b"]).toBe(120);
    expect(byName["cron/c"]).toBe(1440);
    expect(byName["cron/d"]).toBe(10080);
    expect(byName["cron/e"]).toBe(43200);
  });

  it("scheduleTrigger なし WF は expectedIntervalMin=null", () => {
    setup(
      [],
      [
        {
          id: "wf1",
          name: "cron/manual",
          nodes: [{ type: "n8n-nodes-base.webhook" }],
        },
      ],
    );
    const out = run();
    expect(out.workflows[0].expectedIntervalMin).toBeNull();
    expect(out.workflows[0].skipWarning).toBe(false);
  });

  it("max gap を計算し、interval × 2 を超えたら skipWarning=true", () => {
    setup(
      [
        // 5 分間隔のはずが、3 件目で 30 分空く
        { id: "1", workflowId: "wf1", startedAt: "2026-04-25T00:00:00Z" },
        { id: "2", workflowId: "wf1", startedAt: "2026-04-25T00:05:00Z" },
        { id: "3", workflowId: "wf1", startedAt: "2026-04-25T00:35:00Z" },
        { id: "4", workflowId: "wf1", startedAt: "2026-04-25T00:40:00Z" },
      ],
      [
        makeCronWf("wf1", "cron/heartbeat", {
          field: "minutes",
          minutesInterval: 5,
        }),
      ],
    );
    const out = run();
    expect(out.workflows[0].maxGapMin).toBe(30);
    expect(out.workflows[0].skipWarning).toBe(true);
    expect(out.warnings).toHaveLength(1);
  });

  it("max gap が interval × 2 以下なら skipWarning=false", () => {
    setup(
      [
        { id: "1", workflowId: "wf1", startedAt: "2026-04-25T00:00:00Z" },
        { id: "2", workflowId: "wf1", startedAt: "2026-04-25T00:05:00Z" },
        { id: "3", workflowId: "wf1", startedAt: "2026-04-25T00:14:00Z" },
      ],
      [
        makeCronWf("wf1", "cron/heartbeat", {
          field: "minutes",
          minutesInterval: 5,
        }),
      ],
    );
    const out = run();
    expect(out.workflows[0].maxGapMin).toBe(9);
    expect(out.workflows[0].skipWarning).toBe(false);
    expect(out.warnings).toEqual([]);
  });

  it("execution が 1 件以下なら maxGapMin=null", () => {
    setup(
      [{ id: "1", workflowId: "wf1", startedAt: "2026-04-25T00:00:00Z" }],
      [
        makeCronWf("wf1", "cron/daily", {
          field: "days",
          triggerAtHour: 3,
          triggerAtMinute: 0,
        }),
      ],
    );
    const out = run();
    expect(out.workflows[0].executionCount).toBe(1);
    expect(out.workflows[0].maxGapMin).toBeNull();
    expect(out.workflows[0].skipWarning).toBe(false);
  });

  it("warnings は workflows の skipWarning=true サブセットと一致する", () => {
    setup(
      [
        // wf1: skip あり
        { id: "1", workflowId: "wf1", startedAt: "2026-04-25T00:00:00Z" },
        { id: "2", workflowId: "wf1", startedAt: "2026-04-25T01:00:00Z" },
        // wf2: skip なし
        { id: "3", workflowId: "wf2", startedAt: "2026-04-25T00:00:00Z" },
        { id: "4", workflowId: "wf2", startedAt: "2026-04-25T00:05:00Z" },
      ],
      [
        makeCronWf("wf1", "cron/heartbeat", {
          field: "minutes",
          minutesInterval: 5,
        }),
        makeCronWf("wf2", "cron/health", {
          field: "minutes",
          minutesInterval: 10,
        }),
      ],
    );
    const out = run();
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0].name).toBe("cron/heartbeat");
    // workflows は skipWarning=true が先頭に並ぶ
    expect(out.workflows[0].name).toBe("cron/heartbeat");
  });

  it("coverageHours は全 execution の最古〜最新時刻", () => {
    setup(
      [
        { id: "1", workflowId: "wf1", startedAt: "2026-04-25T00:00:00Z" },
        { id: "2", workflowId: "wf2", startedAt: "2026-04-25T12:00:00Z" },
      ],
      [
        makeCronWf("wf1", "cron/a", {
          field: "minutes",
          minutesInterval: 5,
        }),
      ],
    );
    const out = run();
    expect(out.coverageHours).toBe(12);
    expect(out.coverageFrom).toBe("2026-04-25T00:00:00.000Z");
    expect(out.coverageTo).toBe("2026-04-25T12:00:00.000Z");
  });
});
