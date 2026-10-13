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
      "kimi: 日付付き・停止済みの廃止エントリが 0 件です",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].json.severity).toBe("warning");
    expect(out[0].json.repo).toBe("shirankedo");
    expect(out[0].json.summary).toContain("openai: HTTP 503");
    expect(out[0].json.summary).toContain("kimi");
  });

  it("件名は社ごとの全滅にも一部だけ読めない場合にも当てはまる文言にする", () => {
    const out = run(["xiaomi: 停止日を読めない廃止エントリが 1 件（mimo-v3）"]);
    expect(out[0].json.subject).toBe(
      "❌ LLM 廃止一覧の取得・解析で警告（読めなかった分は除外しない）",
    );
  });
});
