import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordWeekly from "./PrepareDiscordWeekly";

function callAndGetItems() {
  const result = prepareDiscordWeekly();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordWeekly", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / 週次レポート生成完了", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("週次レポート生成完了");
  });

  it("失敗時: warning / ❌ / 週次レポート生成失敗", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false, message: "timeout" } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.subject).toContain("週次レポート生成失敗");
    expect(out.summary).toContain("timeout");
  });
});
