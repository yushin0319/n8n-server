import { describe, expect, it, vi, beforeEach } from "vitest";
import prepareDiscordWeekly from "./PrepareDiscordWeekly";

function callAndGetItems() {
  const result = prepareDiscordWeekly();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordWeekly", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に正しいメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u2705")).toBe(true);
    expect(items[0].json.message).toContain("週次レポート生成完了");
  });

  it("失敗時にエラーメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false, message: "timeout" } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u274C")).toBe(true);
    expect(items[0].json.message).toContain("週次レポート生成失敗");
  });
});
