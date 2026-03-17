import { describe, expect, it, vi, beforeEach } from "vitest";
import logDiscordFailure from "./LogDiscordFailure";

/** テスト用: CodeNodeReturn を配列として扱う */
function callAndGetItems() {
  const result = logDiscordFailure();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("LogDiscordFailure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("discordFailed: true を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { error: { message: "Discord API error" } } }),
    });
    vi.stubGlobal("$", (nodeName: string) => ({
      first: () => ({ json: { embed: { title: "test" } } }),
    }));

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0].json.discordFailed).toBe(true);
  });

  it("console.error が呼ばれる", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("$input", {
      first: () => ({ json: { error: { message: "timeout" } } }),
    });
    vi.stubGlobal("$", (nodeName: string) => ({
      first: () => ({ json: { embed: { title: "n8nエラー発生" } } }),
    }));

    callAndGetItems();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0][0]).toContain("Discord通知送信失敗");
    expect(errorSpy.mock.calls[1][0]).toContain("Discord送信エラー");
  });
});
