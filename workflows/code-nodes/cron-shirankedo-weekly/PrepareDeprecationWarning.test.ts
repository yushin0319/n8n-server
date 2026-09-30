import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDeprecationWarning from "./PrepareDeprecationWarning";

function run(warnings: string[]) {
  vi.stubGlobal("$input", {
    first: () => ({
      json: { deprecations: [], deprecationWarnings: warnings },
    }),
  });
  return prepareDeprecationWarning() as INodeExecutionData[];
}

describe("PrepareDeprecationWarning", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("警告が無ければ何も出力しない", () => {
    expect(run([])).toEqual([]);
  });

  it("警告があれば warning で obs-notify に送る", () => {
    const out = run([
      "openai: HTTP 503 (u)",
      "kimi: 日付付きの廃止エントリが 0 件です",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].json.severity).toBe("warning");
    expect(out[0].json.repo).toBe("shirankedo");
    expect(out[0].json.summary).toContain("openai: HTTP 503");
    expect(out[0].json.summary).toContain("kimi");
  });
});
