import { describe, expect, it } from "vitest";
import { discordMessage } from "./discordMessage";

describe("discordMessage", () => {
  it("成功時は✅付きメッセージを返す", () => {
    const msg = discordMessage({
      label: "記事更新",
      isError: false,
      detail: "5件追加",
    });
    expect(msg).toContain("✅");
    expect(msg).toContain("記事更新");
    expect(msg).toContain("5件追加");
  });

  it("失敗時は❌付きメッセージを返す", () => {
    const msg = discordMessage({
      label: "記事投入",
      isError: true,
      detail: "timeout",
    });
    expect(msg).toContain("❌");
    expect(msg).toContain("記事投入");
    expect(msg).toContain("timeout");
  });

  it("detailが省略されたら含まない", () => {
    const msg = discordMessage({
      label: "Star取得",
      isError: false,
    });
    expect(msg).toContain("✅");
    expect(msg).toContain("Star取得");
  });
});
