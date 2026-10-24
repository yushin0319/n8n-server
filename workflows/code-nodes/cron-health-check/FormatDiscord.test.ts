import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDiscord from "./FormatDiscord";

const TARGETS = [
  {
    name: "HistLink Backend",
    url: "https://h.example/health",
    service: "n8n",
    repo: "n8n-server",
  },
  {
    name: "shirankedo",
    url: "https://s.example/",
    service: "cf-worker",
    repo: "shirankedo",
  },
  {
    name: "worldpulse-api",
    url: "https://w.example/health",
    service: "cf-worker",
    repo: "WorldPulse",
  },
];

// CheckTargets (onError: continueRegularOutput) は入力と同じ順で、失敗した item を { error } にして返す
function stub(results: IDataObject[]) {
  vi.stubGlobal("$", (name: string) => {
    if (name === "BuildTargets")
      return { all: () => TARGETS.map((json) => ({ json })) };
    throw new Error(`unexpected $(${name})`);
  });
  vi.stubGlobal("$input", { all: () => results.map((json) => ({ json })) });
}

function run() {
  return (formatDiscord() as INodeExecutionData[]).map((i) => i.json);
}

describe("FormatDiscord", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("全部成功なら allOk の 1 item だけ返す（通知しない）", () => {
    stub([{ status: "ok" }, { ok: true }, { status: "ok" }]);
    expect(run()).toEqual([{ allOk: true }]);
  });

  it("失敗した確認先だけ obs-notify の warning にする", () => {
    stub([
      { status: "ok" },
      { error: { message: "timeout of 30000ms exceeded" } },
      { status: "ok" },
    ]);
    const out = run();
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
    expect(out[0].service).toBe("cf-worker");
    expect(out[0].repo).toBe("shirankedo");
    expect(out[0].subject).toBe("❌ shirankedo DOWN");
    expect(out[0].summary).toContain("https://s.example/");
    expect(out[0].summary).toContain("timeout of 30000ms exceeded");
  });

  it("複数失敗なら失敗した数だけ返す。HistLink は従来の件名・区分のまま", () => {
    stub([
      { error: { message: "502" } },
      { status: "ok" },
      { error: "ECONNRESET" },
    ]);
    const out = run();
    expect(out.map((o) => o.subject)).toEqual([
      "❌ HistLink Backend DOWN",
      "❌ worldpulse-api DOWN",
    ]);
    expect(out[0].service).toBe("n8n");
    expect(out[0].repo).toBe("n8n-server");
    expect(out[1].summary).toContain("ECONNRESET");
  });

  it("summary に JST の日時と失敗の文言が入る", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T10:30:00+09:00"));
    stub([{ error: { message: "x" } }, { status: "ok" }, { status: "ok" }]);
    const out = run();
    expect(out[0].summary).toMatch(/2026/);
    expect(out[0].summary).toContain("ヘルスチェックが失敗しました");
    vi.useRealTimers();
  });
});
