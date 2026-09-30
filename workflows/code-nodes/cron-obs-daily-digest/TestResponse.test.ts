import { beforeEach, describe, expect, it, vi } from "vitest";
import testResponse from "./TestResponse";

function stub(isTest: string, summary: IDataObject) {
  vi.stubGlobal("$", (n: string) => {
    if (n === "AggregateAndFormat") return { first: () => ({ json: summary }) };
    throw new Error(`unknown: ${n}`);
  });
  vi.stubGlobal("$execution", {
    customData: { get: (k: string) => (k === "isTest" ? isTest : undefined) },
  });
}

function run() {
  const result = testResponse();
  const items = Array.isArray(result) ? result : [result];
  return (items as INodeExecutionData[])[0].json;
}

describe("TestResponse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("テストモード: status=ok / test=true / sent=false（スモークテスト合格条件）", () => {
    stub("true", {
      skip: false,
      criticalCount: 0,
      warningCount: 2,
      tradeCount: 1,
    });
    const out = run();
    expect(out.status).toBe("ok");
    expect(out.test).toBe(true);
    expect(out.sent).toBe(false);
    expect(out.warningCount).toBe(2);
  });

  it("本番で送信対象あり → sent=true", () => {
    stub("false", {
      skip: false,
      criticalCount: 0,
      warningCount: 1,
      tradeCount: 0,
    });
    expect(run().sent).toBe(true);
  });

  it("本番で 0 件（skip）→ sent=false", () => {
    stub("false", {
      skip: true,
      criticalCount: 0,
      warningCount: 0,
      tradeCount: 0,
    });
    const out = run();
    expect(out.test).toBe(false);
    expect(out.sent).toBe(false);
  });
});
