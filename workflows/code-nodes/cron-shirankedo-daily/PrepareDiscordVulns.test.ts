import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordVulns from "./PrepareDiscordVulns";

function callAndGetItems() {
  const result = prepareDiscordVulns();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareDiscordVulns", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / 件数 / shirankedo", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });
    vi.stubGlobal("$", (n: string) => {
      if (n === "MergeVulnPaths")
        return { first: () => ({ json: { count: 4 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("shirankedo 脆弱性更新完了");
    expect(out.summary).toContain("4件");
    expect(out.repo).toBe("shirankedo");
  });

  it("エラー時: warning / ❌ / NVD API error / raw_payload", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "NVD API error" } }),
    });
    vi.stubGlobal("$", (n: string) => {
      if (n === "MergeVulnPaths")
        return { first: () => ({ json: { count: 0 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("NVD API error");
    expect(out.raw_payload).toEqual({ error: "NVD API error" });
  });
});
