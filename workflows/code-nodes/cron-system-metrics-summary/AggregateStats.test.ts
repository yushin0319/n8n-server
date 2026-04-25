import { describe, expect, it, vi } from "vitest";
import aggregateStats from "./AggregateStats";

interface AggregateOutput {
  total: number;
  success: number;
  error: number;
  waiting: number;
  other: number;
  avgDurationSec: number;
  coverageHours: number;
  errorRatePct: number;
  topByCount: { name: string; count: number; errors: number }[];
  topByErrors: { name: string; count: number; errors: number }[];
  recentErrors: { wfName: string; id: string; startedAt: string }[];
}

function setup(executions: unknown[], workflows: unknown[]) {
  vi.stubGlobal("$", (name: string) => {
    if (name === "FetchExecutions") {
      return {
        first: () => ({ json: { data: executions } }),
      };
    }
    throw new Error(`unexpected $ call: ${name}`);
  });
  vi.stubGlobal("$input", {
    first: () => ({ json: { data: workflows } }),
  });
}

function run(): AggregateOutput {
  const result = aggregateStats();
  const items = Array.isArray(result) ? result : [result];
  return (items[0] as { json: AggregateOutput }).json;
}

describe("AggregateStats", () => {
  it("空入力でも total=0 で返る", () => {
    setup([], []);
    const out = run();
    expect(out.total).toBe(0);
    expect(out.success).toBe(0);
    expect(out.error).toBe(0);
    expect(out.errorRatePct).toBe(0);
    expect(out.topByCount).toEqual([]);
    expect(out.topByErrors).toEqual([]);
  });

  it("status を集計する", () => {
    setup(
      [
        {
          id: "1",
          workflowId: "wf1",
          status: "success",
          startedAt: "2026-04-25T00:00:00Z",
          stoppedAt: "2026-04-25T00:00:01Z",
        },
        {
          id: "2",
          workflowId: "wf1",
          status: "error",
          startedAt: "2026-04-25T01:00:00Z",
          stoppedAt: "2026-04-25T01:00:02Z",
        },
        {
          id: "3",
          workflowId: "wf2",
          status: "success",
          startedAt: "2026-04-25T02:00:00Z",
          stoppedAt: "2026-04-25T02:00:03Z",
        },
        {
          id: "4",
          workflowId: "wf2",
          status: "waiting",
          startedAt: "2026-04-25T03:00:00Z",
        },
      ],
      [
        { id: "wf1", name: "test/wf1" },
        { id: "wf2", name: "test/wf2" },
      ],
    );
    const out = run();
    expect(out.total).toBe(4);
    expect(out.success).toBe(2);
    expect(out.error).toBe(1);
    expect(out.waiting).toBe(1);
    expect(out.errorRatePct).toBe(25);
  });

  it("workflowId を name に解決する", () => {
    setup(
      [
        {
          id: "1",
          workflowId: "wf1",
          status: "success",
          startedAt: "2026-04-25T00:00:00Z",
        },
      ],
      [{ id: "wf1", name: "cron/test" }],
    );
    const out = run();
    expect(out.topByCount[0].name).toBe("cron/test");
  });

  it("name 解決失敗時は workflowId を使う", () => {
    setup(
      [
        {
          id: "1",
          workflowId: "unknownWf",
          status: "success",
          startedAt: "2026-04-25T00:00:00Z",
        },
      ],
      [],
    );
    const out = run();
    expect(out.topByCount[0].name).toBe("unknownWf");
  });

  it("crashed/canceled も error に含める", () => {
    setup(
      [
        {
          id: "1",
          workflowId: "wf1",
          status: "crashed",
          startedAt: "2026-04-25T00:00:00Z",
        },
        {
          id: "2",
          workflowId: "wf1",
          status: "canceled",
          startedAt: "2026-04-25T00:00:01Z",
        },
      ],
      [{ id: "wf1", name: "test/wf1" }],
    );
    const out = run();
    expect(out.error).toBe(2);
  });

  it("recentErrors は最大5件", () => {
    const execs = [];
    for (let i = 0; i < 10; i++) {
      execs.push({
        id: String(i),
        workflowId: "wf1",
        status: "error",
        startedAt: "2026-04-25T00:00:00Z",
      });
    }
    setup(execs, [{ id: "wf1", name: "test/wf1" }]);
    const out = run();
    expect(out.recentErrors).toHaveLength(5);
  });

  it("avgDurationSec は startedAt-stoppedAt の平均", () => {
    setup(
      [
        {
          id: "1",
          workflowId: "wf1",
          status: "success",
          startedAt: "2026-04-25T00:00:00Z",
          stoppedAt: "2026-04-25T00:00:02Z",
        },
        {
          id: "2",
          workflowId: "wf1",
          status: "success",
          startedAt: "2026-04-25T00:01:00Z",
          stoppedAt: "2026-04-25T00:01:04Z",
        },
      ],
      [{ id: "wf1", name: "test/wf1" }],
    );
    const out = run();
    expect(out.avgDurationSec).toBe(3);
  });
});
