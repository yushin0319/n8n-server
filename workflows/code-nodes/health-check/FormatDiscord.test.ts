import { describe, expect, it, vi } from "vitest";
import formatDiscord from "./FormatDiscord";

/** テスト用: CodeNodeReturn を配列として扱う */
function callAndGetItems() {
  const result = formatDiscord();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatDiscord", () => {
  it("Discord embed構造を返す", () => {
    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveProperty("json.embed");
  });

  it("embedにtitle, description, colorが含まれる", () => {
    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;

    expect(embed.title).toBe("HistLink Backend DOWN");
    expect(embed.color).toBe(15158332);
    expect(typeof embed.description).toBe("string");
  });

  it("descriptionに日本語の失敗メッセージが含まれる", () => {
    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;

    expect(embed.description).toContain("にヘルスチェックが失敗しました。");
  });

  it("descriptionに日時文字列が含まれる", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T10:30:00+09:00"));

    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;

    expect(embed.description).toMatch(/2026/);

    vi.useRealTimers();
  });
});
