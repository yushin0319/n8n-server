import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prepRange from "./PrepRange";

interface RangeOut {
  json: { from: string; to: string; file_date: string };
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
  });

  it("staticData.last_archive_at があればそれを from にする", () => {
    staticData.last_archive_at = "2026-05-08T05:00:00.000Z";
    const out = run();
    expect(out.json.from).toBe("2026-05-08T05:00:00.000Z");
    expect(out.json.to).toBe("2026-05-09T18:00:00.000Z");
  });

  it("file_date は JST タイムゾーンで命名 (UTC 翌日でも JST 当日)", () => {
    vi.setSystemTime(new Date("2026-05-09T15:00:00.000Z")); // JST 翌日 00:00
    const out = run();
    expect(out.json.file_date).toBe("2026-05-10");
  });
});
