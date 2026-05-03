import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordArticles from "./PrepareDiscordArticles";

function callAndGetItems() {
  const result = prepareDiscordArticles();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareDiscordArticles", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: severity=info / 件数を summary に / service=n8n / repo=shirankedo", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { ok: true } }) });
    vi.stubGlobal("$", (n: string) => {
      if (n === "FormatArticles")
        return { first: () => ({ json: { articleCount: 5 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("shirankedo 記事更新完了");
    expect(out.summary).toContain("5件追加");
    expect(out.service).toBe("n8n");
    expect(out.repo).toBe("shirankedo");
  });

  it("エラー時: severity=warning / ❌ / summary にエラー文 / raw_payload に元 input", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "timeout" } }),
    });
    vi.stubGlobal("$", (n: string) => {
      if (n === "FormatArticles")
        return { first: () => ({ json: { articleCount: 0 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("timeout");
    expect(out.raw_payload).toEqual({ error: "timeout" });
  });

  it("statusCode >= 400 もエラー扱い", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { statusCode: 500, message: "server error" } }),
    });
    vi.stubGlobal("$", (n: string) => {
      if (n === "FormatArticles")
        return { first: () => ({ json: { articleCount: 0 } }) };
      throw new Error(`Unknown: ${n}`);
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
  });
});
