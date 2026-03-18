import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordStars from "./PrepareDiscordStars";

function callAndGetItems() {
  const result = prepareDiscordStars();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordStars", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時に正しいメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 100, errors: 0 } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.message).toContain("Star取得");
    expect(items[0].json.message).toContain("100件");
    // discordMessage の成功絵文字
    expect((items[0].json.message as string).startsWith("\u2705")).toBe(true);
  });

  it("エラーありの場合にエラーメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 90, errors: 2 } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.message).toContain("90件成功");
    expect(items[0].json.message).toContain("2件エラー");
    // discordMessage の失敗絵文字
    expect((items[0].json.message as string).startsWith("\u274C")).toBe(true);
  });
});
