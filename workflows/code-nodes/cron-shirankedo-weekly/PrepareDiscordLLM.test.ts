import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordLLM from "./PrepareDiscordLLM";

function callAndGetItems() {
  const result = prepareDiscordLLM();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordLLM", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / 件数を summary に", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true, inserted: 5, updated: 3 } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.summary).toContain("5件追加");
    expect(out.summary).toContain("3件更新");
  });

  it("失敗時: warning / ❌ / LLM価格更新失敗", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: false } }) });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.subject).toContain("LLM価格更新失敗");
  });
});
