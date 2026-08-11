import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prepRange from "./PrepRange";

interface RangeOut {
  json: {
    from: string;
    to: string;
    file_date: string;
    clamped: boolean;
    skipped_hours: number;
  };
}

function run(): RangeOut {
  const result = prepRange();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as RangeOut;
}

describe("PrepRange", () => {
  let staticData: Record<string, unknown>;

  beforeEach(() => {
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", (_scope: string) => staticData);
    // Fix the clock so file_date / to are deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-09T18:00:00.000Z")); // JST 03:00
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("staticData.last_archive_at が空のとき from = now-24h", () => {
    const out = run();
    expect(out.json.to).toBe("2026-05-09T18:00:00.000Z");
    expect(out.json.from).toBe("2026-05-08T18:00:00.000Z");
    expect(out.json.file_date).toBe("2026-05-10"); // JST
    expect(out.json.clamped).toBe(false);
    expect(out.json.skipped_hours).toBe(0);
  });

  it("staticData.last_archive_at があればそれを from にする", () => {
    // 26h の窓に収まる値 (22h 前) を使う。26h を超える場合の挙動は
    // 「checkpoint が 26h より古いとき〜」のケースで別途検証する。
    staticData.last_archive_at = "2026-05-08T20:00:00.000Z";
    const out = run();
    expect(out.json.from).toBe("2026-05-08T20:00:00.000Z");
    expect(out.json.to).toBe("2026-05-09T18:00:00.000Z");
    expect(out.json.clamped).toBe(false);
  });

  it("file_date は JST タイムゾーンで命名 (UTC 翌日でも JST 当日)", () => {
    vi.setSystemTime(new Date("2026-05-09T15:00:00.000Z")); // JST 翌日 00:00
    const out = run();
    expect(out.json.file_date).toBe("2026-05-10");
  });

  it("正常な日次運用 (前回 to = 24h 前) ではクランプされない", () => {
    staticData.last_archive_at = "2026-05-08T18:00:00.000Z"; // ちょうど 24h 前
    const out = run();
    expect(out.json.from).toBe("2026-05-08T18:00:00.000Z");
    expect(out.json.clamped).toBe(false);
  });

  it("26h 以内の遅れはクランプせずそのまま回収する", () => {
    staticData.last_archive_at = "2026-05-08T17:00:00.000Z"; // 25h 前
    const out = run();
    expect(out.json.from).toBe("2026-05-08T17:00:00.000Z");
    expect(out.json.clamped).toBe(false);
  });

  it("checkpoint が 26h より古いとき from を to-26h にクランプする", () => {
    staticData.last_archive_at = "2026-05-04T18:00:00.000Z"; // 5 日前
    const out = run();
    expect(out.json.from).toBe("2026-05-08T16:00:00.000Z"); // to - 26h
    expect(out.json.to).toBe("2026-05-09T18:00:00.000Z");
    expect(out.json.clamped).toBe(true);
    // 5日前(120h) - 26h = 94h 分をスキップ
    expect(out.json.skipped_hours).toBe(94);
  });

  it("last_archive_at がパース不能なら fallback (now-24h) を使う", () => {
    staticData.last_archive_at = "not-a-date";
    const out = run();
    expect(out.json.from).toBe("2026-05-08T18:00:00.000Z");
    expect(out.json.clamped).toBe(false);
  });
});
