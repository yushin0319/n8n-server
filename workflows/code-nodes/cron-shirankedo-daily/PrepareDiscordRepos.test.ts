import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordRepos from "./PrepareDiscordRepos";

function callAndGetItems() {
  const result = prepareDiscordRepos();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordRepos", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("上流の message を info で透過 (info / summary に格納)", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { message: "新規リポなし、スキップ" } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("TrackingRepo更新");
    expect(out.summary).toBe("新規リポなし、スキップ");
  });

  it("成功時: info / total件数を summary に", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 10, errors: 0 } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.summary).toContain("10件追加");
  });

  it("エラー時: warning / ❌ / errors を summary に / raw_payload", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 8, errors: 2 } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("8件追加");
    expect(out.summary).toContain("2件エラー");
    expect(out.raw_payload).toEqual({ total: 8, errors: 2 });
  });
});
