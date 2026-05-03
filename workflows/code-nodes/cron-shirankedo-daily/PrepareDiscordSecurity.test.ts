import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordSecurity from "./PrepareDiscordSecurity";

function callAndGetItems() {
  const result = prepareDiscordSecurity();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareDiscordSecurity", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / 脆弱性件数とリリース件数を summary に", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });
    vi.stubGlobal("$", (n: string) => {
      if (n === "PrepareSecurityComment")
        return {
          first: () => ({ json: { vulnCount: 2, releaseCount: 5 } }),
        };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.summary).toContain("脆弱性2件");
    expect(out.summary).toContain("リリース5件");
  });

  it("エラー時: warning / ❌ / connection failed を summary に", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "connection failed" } }),
    });
    vi.stubGlobal("$", (n: string) => {
      if (n === "PrepareSecurityComment")
        return {
          first: () => ({ json: { vulnCount: 0, releaseCount: 0 } }),
        };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("connection failed");
  });
});
