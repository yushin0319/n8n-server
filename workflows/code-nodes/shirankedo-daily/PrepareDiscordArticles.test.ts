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

  it("成功時は件数付き成功メッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatArticles") {
        return { first: () => ({ json: { articleCount: 5 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("✅");
    expect(msg).toContain("5件追加");
  });

  it("エラー時はエラーメッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "timeout" } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatArticles") {
        return { first: () => ({ json: { articleCount: 0 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("❌");
    expect(msg).toContain("timeout");
  });

  it("statusCode >= 400 もエラーとして扱う", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { statusCode: 500, message: "server error" } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatArticles") {
        return { first: () => ({ json: { articleCount: 0 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;
    expect(msg).toContain("❌");
  });
});
