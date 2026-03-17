import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("成功時は脆弱性件数とリリース件数を含む成功メッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSecurityComment") {
        return { first: () => ({ json: { vulnCount: 2, releaseCount: 5 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("✅");
    expect(msg).toContain("脆弱性2件");
    expect(msg).toContain("リリース5件");
  });

  it("エラー時はエラーメッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "connection failed" } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareSecurityComment") {
        return { first: () => ({ json: { vulnCount: 0, releaseCount: 0 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("❌");
    expect(msg).toContain("connection failed");
  });
});
