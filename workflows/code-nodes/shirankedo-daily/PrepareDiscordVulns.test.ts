import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("成功時は件数付き成功メッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        return { first: () => ({ json: { count: 4 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("✅");
    expect(msg).toContain("4件");
  });

  it("エラー時はエラーメッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "NVD API error" } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        return { first: () => ({ json: { count: 0 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("❌");
    expect(msg).toContain("NVD API error");
  });
});
