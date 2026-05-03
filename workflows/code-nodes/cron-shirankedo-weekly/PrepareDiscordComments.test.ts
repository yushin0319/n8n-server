import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordComments from "./PrepareDiscordComments";

function callAndGetItems() {
  const result = prepareDiscordComments();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordComments", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / ページコメント生成完了", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("ページコメント生成完了");
  });

  it("失敗時: warning / ❌ / ページコメント生成失敗", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false, message: "API error" } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.subject).toContain("ページコメント生成失敗");
    expect(out.summary).toContain("API error");
  });
});
