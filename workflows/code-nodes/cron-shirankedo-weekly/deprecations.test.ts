import { describe, expect, it } from "vitest";
// フィクスチャは 2026-09-30 に各社の公式ページを取得したもの（xAI は llms-full.txt の移行ガイド部分の抜粋）
import anthropicMd from "./__fixtures__/deprecations/anthropic.md.txt?raw";
import deepseekHtml from "./__fixtures__/deprecations/deepseek.html.txt?raw";
import googleMd from "./__fixtures__/deprecations/google.md.txt?raw";
import kimiMd from "./__fixtures__/deprecations/kimi.md.txt?raw";
import openaiMd from "./__fixtures__/deprecations/openai.md.txt?raw";
import xaiGuide from "./__fixtures__/deprecations/xai-llms-full.excerpt.txt?raw";
import xiaomiHtml from "./__fixtures__/deprecations/xiaomi.html.txt?raw";
import {
  buildIndex,
  type DeprecationEntry,
  findRetirement,
  isRetired,
  modelKey,
  parseDeepseek,
  parseKimi,
  parseMarkdownTables,
  parseMonthDate,
  parseXaiGuide,
  parseXaiIndex,
  parseXiaomi,
} from "./deprecations";

/** id → retireAt の対応表 */
function byId(entries: DeprecationEntry[]): Record<string, string | null> {
  return Object.fromEntries(entries.map((e) => [e.id, e.retireAt]));
}

describe("parseMonthDate", () => {
  it.each([
    // 時刻のない日付は「D が地球上のどこでも終わった時刻」= UTC の D+1 12:00
    ["October 23, 2026", "2026-10-24T12:00:00.000Z"],
    ["Oct 1, 2026", "2026-10-02T12:00:00.000Z"],
    ["**August 31, 2026**", "2026-09-01T12:00:00.000Z"],
    ["2026-09-24", "2026-09-25T12:00:00.000Z"],
    // OpenAI の表にある U+2011（改行しないハイフン）
    [
      `2026${String.fromCharCode(0x2011)}03${String.fromCharCode(0x2011)}26`,
      "2026-03-27T12:00:00.000Z",
    ],
  ])("'%s' → %s", (text, expected) => {
    expect(parseMonthDate(text)).toBe(expected);
  });

  it.each([
    "Not sooner than September 1, 2027",
    "No shutdown date announced",
    "To be announced",
    "at earliest 2024-06-13",
    "",
  ])("'%s' は読めないので null", (text) => {
    expect(parseMonthDate(text)).toBeNull();
  });
});

describe("isRetired", () => {
  const entry = {
    vendor: "openai" as const,
    id: "o4-mini",
    retireAt: "2026-10-24T12:00:00.000Z",
  };

  it("停止時刻の前は false、ちょうど以降は true", () => {
    expect(isRetired(entry, new Date("2026-10-24T11:59:59Z"))).toBe(false);
    expect(isRetired(entry, new Date("2026-10-24T12:00:00Z"))).toBe(true);
  });

  it("日付不明は常に false", () => {
    expect(
      isRetired({ ...entry, retireAt: null }, new Date("2100-01-01")),
    ).toBe(false);
  });
});

describe("parseMarkdownTables（OpenAI）", () => {
  const r = parseMarkdownTables(openaiMd, "openai");
  const ids = byId(r.entries);

  it("モデル列の ID と停止日を取り、エイリアスも拾う", () => {
    expect(r.markerFound).toBe(true);
    expect(ids["o4-mini"]).toBe("2026-10-24T12:00:00.000Z");
    expect(ids["o4-mini-2025-04-16"]).toBe("2026-10-24T12:00:00.000Z");
    expect(ids["o3-2025-04-16"]).toBe("2026-12-12T12:00:00.000Z");
    expect(ids["gpt-5.4-cyber"]).toBe("2026-10-02T12:00:00.000Z");
  });

  it("代替モデル列（gpt-5.6-terra 等）は拾わない", () => {
    expect(ids["gpt-5.6-terra"]).toBeUndefined();
    expect(ids["gpt-5.6-sol"]).toBeUndefined();
  });
});

describe("parseMarkdownTables（Anthropic）", () => {
  const ids = byId(parseMarkdownTables(anthropicMd, "anthropic").entries);

  it("Deprecated / Retired の行だけを取る", () => {
    expect(ids["claude-opus-4-1-20250805"]).toBe("2026-08-06T12:00:00.000Z");
    expect(ids["claude-3-haiku-20240307"]).toBe("2026-04-21T12:00:00.000Z");
    // Deprecated だが引退日未定
    expect(ids["claude-mythos-preview"]).toBeNull();
  });

  it("Active の行（Not sooner than ...）は取らない", () => {
    expect(ids["claude-opus-4-7"]).toBeUndefined();
    expect(ids["claude-haiku-4-5-20251001"]).toBeUndefined();
    expect(ids["claude-sonnet-5-5"]).toBeUndefined();
  });
});

describe("parseMarkdownTables（Google）", () => {
  const ids = byId(parseMarkdownTables(googleMd, "google").entries);

  it("停止日のある行は日付付き、未発表の行は null", () => {
    expect(ids["gemini-3-pro-preview"]).toBe("2026-03-10T12:00:00.000Z");
    expect(ids["gemini-3.1-flash-lite"]).toBe("2027-05-08T12:00:00.000Z");
    expect(ids["gemini-3.8-flash"]).toBeNull();
    expect(ids["gemini-3.1-pro-preview"]).toBeNull();
  });
});

describe("xAI", () => {
  it("llms.txt から移行ガイドの .md URL を拾う", () => {
    const txt = [
      "- [Migration Guides](https://docs.x.ai/developers/migration/imagine-image-quality-nov-2.md)",
      "- [Migration Guides — Model Retirement (May 15, 2026)](https://docs.x.ai/developers/migration/may-15-retirement.md)",
      "- [Migration Guides — Migrating to Responses API](https://docs.x.ai/developers/model-capabilities/text/comparison.md)",
    ].join("\n");
    expect(parseXaiIndex(txt)).toEqual([
      "https://docs.x.ai/developers/migration/imagine-image-quality-nov-2.md",
      "https://docs.x.ai/developers/migration/may-15-retirement.md",
    ]);
  });

  it("移行ガイドの箇条書きを引退モデルとし、12:00 PM PT を PST で UTC に換算する", () => {
    const r = parseXaiGuide(xaiGuide);
    const ids = byId(r.entries);
    expect(r.markerFound).toBe(true);
    expect(ids["grok-4-fast-reasoning"]).toBe("2026-05-15T20:00:00.000Z");
    expect(ids["grok-4-fast-non-reasoning"]).toBe("2026-05-15T20:00:00.000Z");
    expect(ids["grok-code-fast-1"]).toBe("2026-05-15T20:00:00.000Z");
    // 表の「Redirect target」列の grok-4.3 は拾わない
    expect(ids["grok-4.3"]).toBeUndefined();
  });
});

describe("parseKimi", () => {
  const r = parseKimi(kimiMd);
  const ids = byId(r.entries);

  it("引用文の日付と、シリーズ宣言による日付を当てる", () => {
    expect(r.markerFound).toBe(true);
    expect(ids["kimi-k2.5"]).toBe("2026-09-01T12:00:00.000Z");
    // "The `kimi-k2` series models were officially discontinued on May 25, 2026"
    expect(ids["kimi-k2-thinking"]).toBe("2026-05-26T12:00:00.000Z");
    expect(ids["moonshot-v1-8k"]).toBe("2026-09-01T12:00:00.000Z");
  });

  it("現行モデルは含まない", () => {
    expect(ids["kimi-k3"]).toBeUndefined();
    expect(ids["kimi-k2.6"]).toBeUndefined();
  });

  it("見出しが無ければ markerFound=false", () => {
    expect(parseKimi("# Model List\n").markerFound).toBe(false);
  });
});

describe("parseXiaomi", () => {
  it("北京時間を UTC に換算する", () => {
    const r = parseXiaomi(xiaomiHtml);
    const ids = byId(r.entries);
    expect(r.markerFound).toBe(true);
    expect(ids["mimo-v2.5"]).toBe("2026-10-21T02:00:00.000Z");
    expect(ids["mimo-v2-pro"]).toBe("2026-06-29T16:00:00.000Z");
    expect(ids["mimo-v2.6-pro"]).toBeUndefined();
  });
});

describe("parseDeepseek", () => {
  it("'models X and Y have been retired' を節の日付で拾う", () => {
    const r = parseDeepseek(deepseekHtml);
    expect(r.markerFound).toBe(true);
    expect(byId(r.entries)).toEqual({
      "DeepSeek V4 Flash": "2026-09-11T12:00:00.000Z",
      "DeepSeek V4 Flash Vision Exp": "2026-09-11T12:00:00.000Z",
    });
  });
});

describe("modelKey", () => {
  it.each([
    ["Claude 4.5 Haiku", "claude-haiku-4-5"],
    ["Claude Opus 5.5 (Max Effort)", "claude-opus-5-5"],
    ["Grok 4 Fast", "grok-4-fast-non-reasoning"],
    ["o3", "o3-2025-04-16"],
    ["MiMo-V2.5", "mimo-v2.5"],
    ["DeepSeek V4 Flash Vision", "DeepSeek V4 Flash Vision Exp"],
    ["Kimi K2.5", "kimi-k2.5"],
  ])("'%s' と '%s' は同じキー", (a, b) => {
    expect(modelKey(a).key).toBe(modelKey(b).key);
  });

  it.each([
    ["GPT-5.4 mini", "gpt-5.4-cyber"],
    ["Kimi K2.6", "kimi-k2"],
    ["Claude 5.4 Haiku", "claude-haiku-4-5"],
    ["o3-pro", "o3"],
    ["Gemini 3.1 Pro Preview", "gemini-3.1-pro"],
  ])("'%s' と '%s' は別のキー", (a, b) => {
    expect(modelKey(a).key).not.toBe(modelKey(b).key);
  });

  it("日付サフィックスの有無を返す（月日として妥当な 4 桁のみ）", () => {
    expect(modelKey("o3-2025-04-16").dated).toBe(true);
    expect(modelKey("claude-3-haiku-20240307").dated).toBe(true);
    expect(modelKey("grok-4-0709").dated).toBe(true);
    expect(modelKey("o3").dated).toBe(false);
    // 2507 は月日として不正（25 月）なので日付扱いしない
    expect(modelKey("Qwen3 235B A22B 2507").dated).toBe(false);
  });
});

describe("findRetirement", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const e = (
    vendor: DeprecationEntry["vendor"],
    id: string,
    retireAt: string | null,
  ): DeprecationEntry => ({ vendor, id, retireAt });

  it("エイリアスが一覧にあれば、全て停止済みのときだけ一致", () => {
    const index = buildIndex([
      e("xai", "grok-4-fast-reasoning", "2026-05-15T20:00:00.000Z"),
      e("xai", "grok-4-fast-non-reasoning", "2026-05-15T20:00:00.000Z"),
    ]);
    expect(findRetirement("Grok 4 Fast", "xAI", index, now)?.id).toBe(
      "grok-4-fast-reasoning",
    );
  });

  it("停止日前・日付不明は一致しない", () => {
    const index = buildIndex([
      e("openai", "o4-mini", "2026-10-24T12:00:00.000Z"),
      e("anthropic", "claude-mythos-preview", null),
    ]);
    expect(findRetirement("o4-mini", "OpenAI", index, now)).toBeNull();
    expect(
      findRetirement(
        "o4-mini",
        "OpenAI",
        index,
        new Date("2026-10-25T00:00:00Z"),
      )?.id,
    ).toBe("o4-mini");
    expect(
      findRetirement("Claude Mythos Preview", "Anthropic", index, now),
    ).toBeNull();
  });

  it("エイリアスが無く日付付きスナップショットが 1 つだけなら同じモデルとみなす", () => {
    const index = buildIndex([
      e("openai", "o3-2025-04-16", "2026-12-12T12:00:00.000Z"),
    ]);
    const after = new Date("2026-12-12T12:00:00Z");
    expect(findRetirement("o3", "OpenAI", index, after)?.id).toBe(
      "o3-2025-04-16",
    );
    expect(findRetirement("o3", "OpenAI", index, now)).toBeNull();
  });

  it("スナップショットが 2 つ以上でエイリアスが無ければ一致しない", () => {
    const index = buildIndex([
      e("anthropic", "claude-3-5-sonnet-20240620", "2025-10-29T12:00:00.000Z"),
      e("anthropic", "claude-3-5-sonnet-20241022", "2025-10-29T12:00:00.000Z"),
    ]);
    expect(
      findRetirement("Claude 3.5 Sonnet", "Anthropic", index, now),
    ).toBeNull();
  });

  it("エイリアスに停止日のないもの（現行）が含まれれば一致しない", () => {
    const index = buildIndex([
      e("google", "gemini-3.1-pro-preview", null),
      e("google", "gemini-3-pro-preview", "2026-03-10T12:00:00.000Z"),
    ]);
    expect(
      findRetirement("Gemini 3.1 Pro Preview", "Google", index, now),
    ).toBeNull();
    expect(
      findRetirement("Gemini 3 Pro Preview", "Google", index, now)?.id,
    ).toBe("gemini-3-pro-preview");
  });

  it("別のベンダーの一覧や、一覧を持たない provider には当てない", () => {
    const index = buildIndex([
      e("openai", "o4-mini", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(findRetirement("o4-mini", "Microsoft", index, now)).toBeNull();
    expect(findRetirement("o4-mini", "Alibaba", index, now)).toBeNull();
  });
});
