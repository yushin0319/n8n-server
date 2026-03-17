import { describe, expect, it, vi, beforeEach } from "vitest";
import prepareDiscordLLM from "./PrepareDiscordLLM";

function callAndGetItems() {
  const result = prepareDiscordLLM();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordLLM", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に件数を含むメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true, inserted: 5, updated: 3 } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u2705")).toBe(true);
    expect(items[0].json.message).toContain("5件追加");
    expect(items[0].json.message).toContain("3件更新");
  });

  it("失敗時にエラーメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u274C")).toBe(true);
    expect(items[0].json.message).toContain("LLM価格更新失敗");
  });
});
