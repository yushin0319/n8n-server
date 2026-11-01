import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareDiscordLLM from "./PrepareDiscordLLM";

function callAndGetItems(...results: Record<string, unknown>[]) {
  vi.stubGlobal("$input", {
    all: () => results.map((json) => ({ json })),
  });
  const result = prepareDiscordLLM();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

const RATE_OK = { ok: true, saved: true };

describe("PrepareDiscordLLM", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("LLM と為替の 2 件を受けても通知は 1 件", () => {
    const items = callAndGetItems(
      { ok: true, inserted: 5, updated: 3 },
      RATE_OK,
    );
    expect(items).toHaveLength(1);
  });

  it("成功時: info / 件数を summary に", () => {
    const out = callAndGetItems(
      { ok: true, inserted: 5, updated: 3 },
      RATE_OK,
    )[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
    expect(out.subject).toContain("LLM価格更新完了");
    expect(out.summary).toContain("5件追加");
    expect(out.summary).toContain("3件更新");
  });

  it("成功時: 削除件数があれば summary に出す", () => {
    const out = callAndGetItems(
      { ok: true, inserted: 2, updated: 1, deleted: 4 },
      RATE_OK,
    )[0].json;
    expect(out.summary).toContain("4件削除");
  });

  it("LLM の送信が失敗: warning / ❌ / LLM価格更新失敗", () => {
    const out = callAndGetItems({ ok: false }, RATE_OK)[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("❌");
    expect(out.subject).toContain("LLM価格更新失敗");
  });

  it("為替の送信だけ失敗: warning / 為替レート更新失敗 (LLM の件数ではない)", () => {
    const out = callAndGetItems(
      { ok: true, inserted: 1, updated: 0 },
      { error: { message: "500 Internal Server Error" } },
    )[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("為替レート更新失敗");
    expect(out.subject).not.toContain("LLM価格");
    expect(out.summary).toContain("500 Internal Server Error");
  });

  it("両方失敗: どちらも subject に出す", () => {
    const out = callAndGetItems({ ok: false }, { ok: false })[0].json;
    expect(out.subject).toContain("LLM価格・為替レート更新失敗");
  });

  it("為替の結果が届かない: 失敗として扱う", () => {
    const out = callAndGetItems({ ok: true, inserted: 1, updated: 0 })[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("為替レート更新失敗");
  });
});
