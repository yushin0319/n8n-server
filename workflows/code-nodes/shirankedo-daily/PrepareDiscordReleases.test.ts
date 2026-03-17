import { describe, expect, it, vi, beforeEach } from "vitest";
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

  it("成功時は件数付き成功メッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeReleasePaths") {
        return { first: () => ({ json: { count: 3 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("✅");
    expect(msg).toContain("3件");
  });

  it("エラー時はエラーメッセージを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: "API timeout" } }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeReleasePaths") {
        return { first: () => ({ json: { count: 0 } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const msg = items[0].json.message as string;

    expect(msg).toContain("❌");
    expect(msg).toContain("API timeout");
  });
});
