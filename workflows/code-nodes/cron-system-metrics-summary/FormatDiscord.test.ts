import { describe, expect, it, vi } from "vitest";
import formatDiscord from "./FormatDiscord";

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

function setup(stats: Record<string, unknown>) {
  vi.stubGlobal("$input", {
    first: () => ({ json: stats }),
  });
}

function run(): DiscordEmbed {
  const result = formatDiscord();
  const items = Array.isArray(result) ? result : [result];
  return (items[0] as { json: { embed: DiscordEmbed } }).json.embed;
}

const baseStats = {
  total: 100,
  success: 99,
  error: 1,
  waiting: 0,
  other: 0,
  avgDurationSec: 1.5,
  coverageHours: 12.3,
  errorRatePct: 1.0,
  topByCount: [],
  topByErrors: [],
  recentErrors: [],
  coverageFrom: "2026-04-25T00:00:00Z",
  coverageTo: "2026-04-25T12:00:00Z",
};

describe("FormatDiscord", () => {
  it("embed を1件返す", () => {
    setup(baseStats);
    const embed = run();
    expect(embed.title).toContain("n8n Daily Metrics Summary");
  });

  it("error rate 0% は緑", () => {
    setup({ ...baseStats, errorRatePct: 0, error: 0 });
    expect(run().color).toBe(0x2ecc71);
  });

  it("error rate 2% は黄", () => {
    setup({ ...baseStats, errorRatePct: 2 });
    expect(run().color).toBe(0xf1c40f);
  });

  it("error rate 10% は赤", () => {
    setup({ ...baseStats, errorRatePct: 10 });
    expect(run().color).toBe(0xe74c3c);
  });

  it("Status / Error Rate / Avg Duration field がある", () => {
    setup(baseStats);
    const fields = run().fields;
    expect(fields.find((f) => f.name === "Status")).toBeTruthy();
    expect(fields.find((f) => f.name === "Error Rate")).toBeTruthy();
    expect(fields.find((f) => f.name === "Avg Duration")).toBeTruthy();
  });

  it("topByCount があれば Top WFs field を追加する", () => {
    setup({
      ...baseStats,
      topByCount: [
        { name: "cron/health-check", count: 144, errors: 0 },
        { name: "cron/system-heartbeat", count: 288, errors: 1 },
      ],
    });
    const top = run().fields.find((f) => f.name === "Top WFs (by count)");
    expect(top?.value).toContain("cron/health-check");
    expect(top?.value).toContain("cron/system-heartbeat");
    expect(top?.value).toContain("err 1");
  });

  it("topByErrors が空なら field を出さない", () => {
    setup(baseStats);
    expect(run().fields.find((f) => f.name === "Errors by WF")).toBeUndefined();
  });

  it("recentErrors を整形する", () => {
    setup({
      ...baseStats,
      recentErrors: [
        { wfName: "cron/foo", id: "12345", startedAt: "2026-04-25T03:14:15Z" },
      ],
    });
    const re = run().fields.find((f) => f.name === "Recent Errors");
    expect(re?.value).toContain("[12345]");
    expect(re?.value).toContain("cron/foo");
  });
});
