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

  it("成功時: info / Star取得 100件 / 絵文字 ✅", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 100, errors: 0 } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("Star取得");
    expect(out.summary).toContain("100件");
  });

  it("エラー時: warning / ❌ / 90件成功 + 2件エラー", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { total: 90, errors: 2 } }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("90件成功");
    expect(out.summary).toContain("2件エラー");
  });
});
