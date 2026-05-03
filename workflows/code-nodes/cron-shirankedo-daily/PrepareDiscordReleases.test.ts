import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordReleases from "./PrepareDiscordReleases";

function callAndGetItems() {
  const result = prepareDiscordReleases();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareDiscordReleases", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: info / 件数を summary に", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });
    vi.stubGlobal("$", (n: string) => {
      if (n === "MergeReleasePaths")
        return { first: () => ({ json: { count: 3 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("shirankedo リリース更新完了");
    expect(out.summary).toContain("3件");
  });

  it("エラー時: warning / ❌ / API timeout を summary に", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "API timeout" } }),
    });
    vi.stubGlobal("$", (n: string) => {
      if (n === "MergeReleasePaths")
        return { first: () => ({ json: { count: 0 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("API timeout");
  });
});
