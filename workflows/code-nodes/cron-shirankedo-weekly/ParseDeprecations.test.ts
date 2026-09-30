import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import anthropicMd from "./__fixtures__/deprecations/anthropic.md.txt?raw";
import deepseekHtml from "./__fixtures__/deprecations/deepseek.html.txt?raw";
import googleMd from "./__fixtures__/deprecations/google-models.md.txt?raw";
import kimiMd from "./__fixtures__/deprecations/kimi.md.txt?raw";
import openaiMd from "./__fixtures__/deprecations/openai.md.txt?raw";
import xaiGuide from "./__fixtures__/deprecations/xai-llms-full.excerpt.txt?raw";
import xiaomiHtml from "./__fixtures__/deprecations/xiaomi.html.txt?raw";
import parseDeprecations, { collectDeprecations } from "./ParseDeprecations";

/**
 * MergeDeprecationPages の出力 1 件 = 取得元 { vendor, url } と、
 * n8n 2.23.4 HttpRequestV3（fullResponse + responseFormat: text + outputPropertyName: "body"）の出力
 * { body, headers, statusCode, statusMessage } を位置で結合したもの
 */
function page(vendor: string, body: string, statusCode = 200): IDataObject {
  return {
    vendor,
    url: `https://example.test/${vendor}`,
    body,
    headers: { "content-type": "text/markdown" },
    statusCode,
    statusMessage: "OK",
  };
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

  it("outputPropertyName が既定値（data）のままの出力でも本文を読む", () => {
    // n8n 2.23.4 の既定: 本文は data キー（HttpRequestV3.node.ts の responseFormat === 'text' 分岐）
    const pages = allOk().map((p) => {
      const { body, ...rest } = p;
      return { ...rest, data: body };
    });
    const r = collectDeprecations(pages);
    expect(r.deprecationWarnings).toEqual([]);
    expect(r.deprecations.some((e) => e.vendor === "openai")).toBe(true);
  });

  it("本文が無い出力は取得失敗として警告する", () => {
    const pages = allOk().map((p) => {
      if (p.vendor !== "google") return p;
      const { body: _body, ...rest } = p;
      return rest;
    });
    expect(collectDeprecations(pages).deprecationWarnings).toEqual([
      "google: 本文がありません (https://example.test/google)",
    ]);
  });

  it("リトライ後も失敗した項目（continueRegularOutput の { error }）を警告する", () => {
    // HttpRequestV3: continueOnFail 時は { error: responseData.reason } だけを出す
    const pages = allOk().map((p) =>
      p.vendor === "kimi"
        ? {
            vendor: "kimi",
            url: "u",
            error: { message: "Service unavailable", httpCode: "503" },
          }
        : p,
    );
    expect(collectDeprecations(pages).deprecationWarnings).toEqual([
      "kimi: HTTP 503 Service unavailable (u)",
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
      "kimi: 日付付き・停止済みの廃止エントリが 0 件です",
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

describe("collectDeprecations（解析中の例外）", () => {
  afterEach(() => {
    vi.doUnmock("./_shared/deprecations");
    vi.resetModules();
  });

  it("1 社の解析で例外が出ても他社は続行し、警告を出す", async () => {
    vi.resetModules();
    vi.doMock("./_shared/deprecations", async (importOriginal) => {
      const mod =
        await importOriginal<typeof import("./_shared/deprecations")>();
      return {
        ...mod,
        parseVendorPage: (vendor: string, body: string) => {
          if (vendor === "openai") throw new Error("boom");
          return mod.parseVendorPage(vendor as never, body);
        },
      };
    });
    const { collectDeprecations: collect } = await import(
      "./ParseDeprecations"
    );
    const r = collect(allOk());
    expect(r.deprecations.some((e) => e.vendor === "openai")).toBe(false);
    expect(r.deprecations.some((e) => e.vendor === "anthropic")).toBe(true);
    expect(r.deprecationWarnings).toEqual(["openai: 解析で例外: Error: boom"]);
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
