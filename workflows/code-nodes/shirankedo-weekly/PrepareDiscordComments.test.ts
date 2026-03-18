import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordComments from "./PrepareDiscordComments";

function callAndGetItems() {
  const result = prepareDiscordComments();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordComments", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に正しいメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u2705")).toBe(true);
    expect(items[0].json.message).toContain("ページコメント生成完了");
  });

  it("失敗時にエラーメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false, message: "API error" } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u274C")).toBe(true);
    expect(items[0].json.message).toContain("ページコメント生成失敗");
  });
});
