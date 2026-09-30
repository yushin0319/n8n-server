import { describe, expect, it } from "vitest";
// フィクスチャは 2026-09-30 に各社の公式ページを取得したもの（xAI は llms-full.txt の移行ガイド部分の抜粋）
import anthropicMd from "../__fixtures__/deprecations/anthropic.md.txt?raw";
import deepseekHtml from "../__fixtures__/deprecations/deepseek.html.txt?raw";
import googleModelsMd from "../__fixtures__/deprecations/google-models.md.txt?raw";
import kimiMd from "../__fixtures__/deprecations/kimi.md.txt?raw";
import openaiMd from "../__fixtures__/deprecations/openai.md.txt?raw";
import xaiGuide from "../__fixtures__/deprecations/xai-llms-full.excerpt.txt?raw";
import xiaomiHtml from "../__fixtures__/deprecations/xiaomi.html.txt?raw";
import {
  buildIndex,
  type DeprecationEntry,
  findRetirement,
  htmlToText,
  isRetired,
  modelKey,
  parseDeepseek,
  parseGoogleModels,
  parseKimi,
  parseMarkdownTables,
  parseMonthDate,
  parseXaiGuide,
  parseXaiIndex,
  parseXiaomi,
  snapshotNearRelease,
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

describe("htmlToText", () => {
  it("大文字や空白入りの閉じタグの script / style も取り除く", () => {
    expect(
      htmlToText(
        "<p>a</p><SCRIPT>x()</SCRIPT ><style>.b{}</style>\n<Style>c</STYLE>b",
      ).trim(),
    ).toBe("a b");
  });

  it("&amp; は最後に戻す（二重に戻さない）", () => {
    expect(htmlToText("&amp;lt;x&amp;gt; &lt;y&gt;").trim()).toBe(
      "&lt;x&gt; <y>",
    );
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

describe("parseGoogleModels", () => {
  const r = parseGoogleModels(googleModelsMd);
  const ids = r.entries.map((e) => e.id).sort();

  it("models ページで (Shut down) の行だけを停止済みとする", () => {
    expect(r.markerFound).toBe(true);
    expect(ids).toEqual([
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-3-pro-preview",
      "gemini-3.1-flash-lite-preview",
      "imagen-4.0-generate",
    ]);
    expect(r.entries.every((e) => e.stopped && e.retireAt === null)).toBe(true);
  });

  it("現行・最短停止日だけのモデルは含まない（deprecations の Shutdown date は使わない）", () => {
    // gemini-3.1-flash-lite は deprecations ページで「最短 2027-05-07」だが現行
    expect(ids).not.toContain("gemini-3.1-flash-lite");
    expect(ids).not.toContain("gemini-3.8-flash");
    expect(ids).not.toContain("gemini-2.5-flash");
  });

  it("Endpoint 列のある表が無ければ markerFound=false", () => {
    expect(
      parseGoogleModels("| Model | Shutdown date |\n|---|---|\n").markerFound,
    ).toBe(false);
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

describe("parseDeepseek（文の形）", () => {
  const page = (body: string) => `<p>Date: 2026-09-10</p><p>${body}</p>`;

  it("版番号の '.' で切らない（V4.1 / V3.2）", () => {
    expect(
      byId(
        parseDeepseek(
          page("The models V4.1 Flash Preview and V3.2 have been retired."),
        ).entries,
      ),
    ).toEqual({
      "DeepSeek V4.1 Flash Preview": "2026-09-11T12:00:00.000Z",
      "DeepSeek V3.2": "2026-09-11T12:00:00.000Z",
    });
  });

  it("'X, Y, and Z' の Oxford カンマで区切る", () => {
    expect(
      Object.keys(
        byId(
          parseDeepseek(
            page("The models V3, V3.1, and V3.2 Exp have been retired."),
          ).entries,
        ),
      ),
    ).toEqual(["DeepSeek V3", "DeepSeek V3.1", "DeepSeek V3.2 Exp"]);
  });

  it("'model aliases X and Y' の前置きを外す", () => {
    expect(
      Object.keys(
        byId(
          parseDeepseek(
            page(
              "The model aliases deepseek-chat and deepseek-reasoner have been retired.",
            ),
          ).entries,
        ),
      ),
    ).toEqual(["deepseek-chat", "deepseek-reasoner"]);
  });
});

describe("dedupe（同じ ID が複数の表にある場合）", () => {
  const md = (rows: string[]) =>
    ["| Shutdown date | Model |", "| --- | --- |", ...rows, ""].join("\n");

  it("遅い日付を採用する（早い日付では消さない）", () => {
    const r = parseMarkdownTables(
      md([
        "| Oct 1, 2026 | `m1` |",
        "| Dec 1, 2026 | `m1` |",
        "| Nov 1, 2026 | `m1` |",
      ]),
      "openai",
    );
    expect(byId(r.entries)).toEqual({ m1: "2026-12-02T12:00:00.000Z" });
  });

  it("日付未定（延期・未発表）が 1 つでもあれば null を採用する", () => {
    const r = parseMarkdownTables(
      md([
        "| Oct 1, 2026 | `m1` |",
        "| To be announced | `m1` |",
        "| Dec 1, 2026 | `m1` |",
      ]),
      "openai",
    );
    expect(byId(r.entries)).toEqual({ m1: null });
  });

  it("確定した停止日は、古い 'at earliest' の注記より優先する", () => {
    // OpenAI の gpt-4-0314: 古い表 "at earliest 2024-06-13" と、後の表の確定停止日 2026-03-26
    const r = parseMarkdownTables(
      md(["| at earliest 2024-06-13 | `m1` |", "| 2026-03-26 | `m1` |"]),
      "openai",
    );
    expect(byId(r.entries)).toEqual({ m1: "2026-03-27T12:00:00.000Z" });
  });

  it("OpenAI のフィクスチャでも gpt-4-0314 は確定停止日になる", () => {
    expect(
      byId(parseMarkdownTables(openaiMd, "openai").entries)["gpt-4-0314"],
    ).toBe("2026-03-27T12:00:00.000Z");
  });
});

describe("parseXiaomi（列の順序）", () => {
  it("見出しで Deprecated Time 列を探す（列の並びが変わっても読める）", () => {
    const html = `<table><thead><tr><th>Note</th><th>System replacement time</th><th>Deprecated Time</th><th>Deprecated Model</th><th>System Replacement Model</th></tr></thead>
<tbody><tr><td>x</td><td>Beijing Time 2026.6.1 00:00</td><td>Beijing Time 2026.6.30 00:00</td><td>mimo-v2-pro</td><td>mimo-v2.5-pro</td></tr></tbody></table>`;
    const r = parseXiaomi(html);
    expect(r.markerFound).toBe(true);
    expect(byId(r.entries)).toEqual({
      "mimo-v2-pro": "2026-06-29T16:00:00.000Z",
    });
  });

  it("Deprecated Time 列が無い表は無視する", () => {
    const r = parseXiaomi(
      "<table><tr><th>Model</th><th>Price</th></tr><tr><td>mimo-v2.6-pro</td><td>1</td></tr></table>",
    );
    expect(r).toEqual({ entries: [], markerFound: false });
  });
});

describe("modelKey", () => {
  it.each([
    ["Claude 4.5 Haiku", "claude-haiku-4-5"],
    ["Claude Opus 5.5 (Max Effort)", "claude-opus-5-5"],
    ["Grok 4 Fast", "grok-4-fast-non-reasoning"],
    ["o3", "o3-2025-04-16"],
    ["MiMo-V2.5", "mimo-v2.5"],
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

  it("推論モード・推論強度の括弧書きは外し、版の注記扱いにしない", () => {
    const k = modelKey(
      "Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)",
    );
    expect(k).toEqual(modelKey("claude-opus-5-5"));
    expect(modelKey("o4-mini (high)")).toEqual(modelKey("o4-mini"));
    expect(modelKey("Grok 4 Fast (Non-reasoning)").dated).toBe(false);
  });

  it("日付・スナップショットの括弧書きは外すが、版の注記付き（dated）にする", () => {
    expect(modelKey("GPT-4o (Aug '24)")).toEqual({
      key: modelKey("gpt-4o").key,
      dated: true,
    });
    expect(modelKey("Qwen3.8 Max (0902)").dated).toBe(true);
    expect(modelKey("Mistral Large 2 (Nov '24)").dated).toBe(true);
    expect(modelKey("MiMo-V2-Flash (Feb 2026)").dated).toBe(true);
  });

  it("それ以外の括弧書き（ChatGPT / Preview 等）は語としてキーに残す", () => {
    expect(modelKey("GPT-4o (ChatGPT)").key).not.toBe(modelKey("gpt-4o").key);
    expect(modelKey("GPT-4o (ChatGPT)").dated).toBe(true);
    expect(modelKey("Gemini 2.0 Flash-Lite (Preview)").key).toBe(
      modelKey("gemini-2.0-flash-lite-preview").key,
    );
  });

  it("exp は ignoreExp（DeepSeek）のときだけ無視する", () => {
    expect(modelKey("DeepSeek V4 Flash Vision", { ignoreExp: true }).key).toBe(
      modelKey("DeepSeek V4 Flash Vision Exp", { ignoreExp: true }).key,
    );
    expect(modelKey("Gemini 2.0 Flash").key).not.toBe(
      modelKey("gemini-2.0-flash-exp").key,
    );
  });

  it("日付サフィックスの有無を返す（月日として妥当な 4 桁のみ）", () => {
    expect(modelKey("o3-2025-04-16").dated).toBe(true);
    expect(modelKey("claude-3-haiku-20240307").dated).toBe(true);
    expect(modelKey("grok-4-0709").dated).toBe(true);
    expect(modelKey("gemini-2.5-pro-preview-03-25")).toEqual({
      key: modelKey("gemini-2.5-pro-preview").key,
      dated: true,
    });
    expect(modelKey("gemini-2.5-flash-lite-preview-09-2025")).toEqual({
      key: modelKey("gemini-2.5-flash-lite-preview").key,
      dated: true,
    });
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
    expect(findRetirement("o3", "OpenAI", index, after, "2025-04-16")?.id).toBe(
      "o3-2025-04-16",
    );
    expect(findRetirement("o3", "OpenAI", index, now, "2025-04-16")).toBeNull();
  });

  it("スナップショットの日付が AA の公開日から ±7 日を超える・公開日が無い場合は一致しない", () => {
    const index = buildIndex([
      e("openai", "o3-2025-04-16", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(findRetirement("o3", "OpenAI", index, now, "2025-04-23")?.id).toBe(
      "o3-2025-04-16",
    );
    expect(findRetirement("o3", "OpenAI", index, now, "2025-04-24")).toBeNull();
    expect(findRetirement("o3", "OpenAI", index, now, null)).toBeNull();
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

  it("AA 名に版・日付の注記があれば、単一スナップショットの例外を使わない", () => {
    const index = buildIndex([
      e("openai", "gpt-4o-2024-05-13", "2026-01-01T00:00:00.000Z"),
    ]);
    // 注記なしでも、公開日がスナップショット（2024-05-13）と離れていれば別物
    expect(
      findRetirement("GPT-4o", "OpenAI", index, now, "2024-08-06"),
    ).toBeNull();
    expect(
      findRetirement("GPT-4o", "OpenAI", index, now, "2024-11-20"),
    ).toBeNull();
    expect(
      findRetirement("GPT-4o", "OpenAI", index, now, "2024-05-13")?.id,
    ).toBe("gpt-4o-2024-05-13");
    for (const name of [
      "GPT-4o (Aug '24)",
      "GPT-4o (May '24)",
      "GPT-4o (Nov '24)",
      "GPT-4o (ChatGPT)",
    ]) {
      expect(
        findRetirement(name, "OpenAI", index, now, "2024-05-13"),
      ).toBeNull();
    }
  });

  it("推論強度の括弧書きだけなら単一スナップショットの例外を使う", () => {
    const index = buildIndex([
      e("openai", "o3-2025-04-16", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(
      findRetirement("o3 (high)", "OpenAI", index, now, "2025-04-16")?.id,
    ).toBe("o3-2025-04-16");
  });

  it("Google の *-exp は別モデル（Gemini 2.0 Flash を引退扱いにしない）", () => {
    const index = buildIndex([
      e("google", "gemini-2.0-flash-exp", "2025-01-01T00:00:00.000Z"),
    ]);
    expect(findRetirement("Gemini 2.0 Flash", "Google", index, now)).toBeNull();
  });

  it("DeepSeek だけは exp を同一視する", () => {
    const index = buildIndex([
      e("deepseek", "DeepSeek V4 Flash Vision Exp", "2026-09-11T12:00:00.000Z"),
    ]);
    expect(
      findRetirement("DeepSeek V4 Flash Vision", "DeepSeek", index, now)?.id,
    ).toBe("DeepSeek V4 Flash Vision Exp");
  });

  it("別のベンダーの一覧や、一覧を持たない provider には当てない", () => {
    const index = buildIndex([
      e("openai", "o4-mini", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(findRetirement("o4-mini", "Microsoft", index, now)).toBeNull();
    expect(findRetirement("o4-mini", "Alibaba", index, now)).toBeNull();
  });
});

describe("snapshotNearRelease", () => {
  it.each([
    ["o3-2025-04-16", "2025-04-16", true],
    ["o3-2025-04-16", "2025-04-09", true],
    ["o3-2025-04-16", "2025-04-08", false],
    ["claude-3-haiku-20240307", "2024-03-13", true],
    // 年の無い MMDD は公開日の前後の年で最も近いものと比べる
    ["grok-4-0709", "2025-07-09", true],
    ["grok-4-0709", "2025-08-01", false],
    // MM-DD（Google 形式）
    ["gemini-2.5-pro-preview-03-25", "2025-03-25", true],
    // 日の無い MM-YYYY は比較できない
    ["gemini-2.5-flash-lite-preview-09-2025", "2025-09-25", false],
    ["o3", "2025-04-16", false],
    ["o3-2025-04-16", "", false],
  ])("%s / 公開日 %s → %s", (id, rel, expected) => {
    expect(snapshotNearRelease(id, rel)).toBe(expected);
  });
});
