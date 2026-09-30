import { beforeEach, describe, expect, it, vi } from "vitest";
import anthropicMd from "./__fixtures__/deprecations/anthropic.md.txt?raw";
import deepseekHtml from "./__fixtures__/deprecations/deepseek.html.txt?raw";
import googleMd from "./__fixtures__/deprecations/google.md.txt?raw";
import kimiMd from "./__fixtures__/deprecations/kimi.md.txt?raw";
import openaiMd from "./__fixtures__/deprecations/openai.md.txt?raw";
import xaiGuide from "./__fixtures__/deprecations/xai-llms-full.excerpt.txt?raw";
import xiaomiHtml from "./__fixtures__/deprecations/xiaomi.html.txt?raw";
import parseDeprecations, { collectDeprecations } from "./ParseDeprecations";

/** FetchDeprecationPages（fullResponse）と取得元をマージした 1 件 */
function page(vendor: string, body: string, statusCode = 200): IDataObject {
  return { vendor, url: `https://example.test/${vendor}`, statusCode, body };
}

const allOk = (): IDataObject[] => [
  page("openai", openaiMd),
  page("anthropic", anthropicMd),
  page("google", googleMd),
  page("xai-index", "(llms.txt)"),
  page("kimi", kimiMd),
  page("xiaomi", xiaomiHtml),
  page("deepseek", deepseekHtml),
  page("xai", xaiGuide),
];

describe("collectDeprecations", () => {
  it("7 社すべて取れれば警告なし", () => {
    const r = collectDeprecations(allOk());
    expect(r.deprecationWarnings).toEqual([]);
    const vendors = new Set(r.deprecations.map((e) => e.vendor));
    expect([...vendors].sort()).toEqual([
      "anthropic",
      "deepseek",
      "google",
      "kimi",
      "openai",
      "xai",
      "xiaomi",
    ]);
  });

  it("HTTP エラーの社はエントリを使わず警告する（他社は使う）", () => {
    const pages = allOk().map((p) =>
      p.vendor === "openai" ? { ...p, statusCode: 503 } : p,
    );
    const r = collectDeprecations(pages);
    expect(r.deprecations.some((e) => e.vendor === "openai")).toBe(false);
    expect(r.deprecations.some((e) => e.vendor === "anthropic")).toBe(true);
    expect(r.deprecationWarnings).toEqual([
      "openai: HTTP 503 (https://example.test/openai)",
    ]);
  });

  it("通信エラー（statusCode なし）も警告する", () => {
    const pages = allOk().map((p) =>
      p.vendor === "kimi"
        ? { vendor: "kimi", url: "u", error: { message: "x" } }
        : p,
    );
    expect(collectDeprecations(pages).deprecationWarnings).toEqual([
      "kimi: HTTP error (u)",
    ]);
  });

  it("表・見出しが見つからない社は警告する", () => {
    const pages = allOk().map((p) =>
      p.vendor === "google" ? page("google", "# Moved\n") : p,
    );
    const r = collectDeprecations(pages);
    expect(r.deprecations.some((e) => e.vendor === "google")).toBe(false);
    expect(r.deprecationWarnings).toEqual([
      "google: 廃止一覧の表・見出しが見つかりません",
    ]);
  });

  it("見出しはあるが日付付きエントリが 0 件なら警告する", () => {
    const pages = allOk().map((p) =>
      p.vendor === "kimi" ? page("kimi", "## Deprecated Models\n") : p,
    );
    const r = collectDeprecations(pages);
    expect(r.deprecations.some((e) => e.vendor === "kimi")).toBe(false);
    expect(r.deprecationWarnings).toEqual([
      "kimi: 日付付きの廃止エントリが 0 件です",
    ]);
  });

  it("xAI の llms.txt 取得失敗（indexError）を警告する", () => {
    const pages = allOk()
      .filter((p) => p.vendor !== "xai")
      .concat({ vendor: "xai", url: "u", indexError: "llms.txt: HTTP 500" });
    const r = collectDeprecations(pages);
    expect(r.deprecations.some((e) => e.vendor === "xai")).toBe(false);
    expect(r.deprecationWarnings).toEqual(["xai: llms.txt: HTTP 500"]);
  });

  it("取得結果が無い社も警告する", () => {
    const pages = allOk().filter((p) => p.vendor !== "deepseek");
    expect(collectDeprecations(pages).deprecationWarnings).toEqual([
      "deepseek: 取得結果がありません",
    ]);
  });
});

describe("ParseDeprecations（ノード）", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("入力を 1 件にまとめて出力する", () => {
    vi.stubGlobal("$input", { all: () => allOk().map((json) => ({ json })) });
    const out = parseDeprecations() as INodeExecutionData[];
    expect(out).toHaveLength(1);
    expect(out[0].json.deprecationWarnings).toEqual([]);
    expect((out[0].json.deprecations as unknown[]).length).toBeGreaterThan(100);
  });
});
