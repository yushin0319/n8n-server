import { describe, expect, it, vi, beforeEach } from "vitest";
import prepareDiscordRepos from "./PrepareDiscordRepos";

function callAndGetItems() {
  const result = prepareDiscordRepos();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareDiscordRepos", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("messageフィールドがある場合はそのまま返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { message: "新規リポなし、スキップ" } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.message).toBe("新規リポなし、スキップ");
  });

  it("成功時にtotal件数を含むメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 10, errors: 0 } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u2705")).toBe(true);
    expect(items[0].json.message).toContain("10件追加");
  });

  it("エラーがある場合にエラーメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 8, errors: 2 } }),
    });

    const items = callAndGetItems();
    expect((items[0].json.message as string).startsWith("\u274C")).toBe(true);
    expect(items[0].json.message).toContain("8件追加");
    expect(items[0].json.message).toContain("2件エラー");
  });
});
