import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import parseLLMData, {
  dropSuperseded,
  familyKey,
  seriesOf,
  shouldSkip,
} from "./ParseLLMData";

/** テスト用のAAモデルデータを生成 */
function makeModel(
  overrides: {
    name?: string;
    creator?: string;
    inputPrice?: number;
    outputPrice?: number;
    score?: number;
  } = {},
): IDataObject {
  return {
    name: overrides.name ?? "Claude 4.5 Sonnet",
    model_creator: { name: overrides.creator ?? "Anthropic" },
    pricing: {
      price_1m_input_tokens: overrides.inputPrice ?? 3,
      price_1m_output_tokens: overrides.outputPrice ?? 15,
    },
    evaluations: {
      artificial_analysis_intelligence_index: overrides.score ?? 80,
    },
  };
}

/** MergeWithDeprecations(combineAll)の出力をモック: AAデータ・為替・廃止一覧が1オブジェクトに統合 */
function stubMergedInput(
  aaData: IDataObject[],
  rates: Record<string, number> = { JPY: 150 },
  deprecations: IDataObject[] = [],
) {
  vi.stubGlobal("$input", {
    all: () => [{ json: { data: aaData, rates, deprecations } }],
  });
}

function callAndGetItems() {
  const result = parseLLMData();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ParseLLMData", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("基本的なモデルデータをフィルタ・整形して出力する", () => {
    stubMergedInput(
      [
        makeModel({ name: "Claude 4.5 Sonnet", score: 85 }),
        makeModel({ name: "GPT-4o", creator: "OpenAI", score: 80 }),
      ],
      { JPY: 150, EUR: 0.92 },
    );

    const items = callAndGetItems();
    // [0] = LLMモデル, [1] = 為替レート
    expect(items).toHaveLength(2);

    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(2);
    expect(models[0].score).toBeGreaterThanOrEqual(models[1].score);
    expect(items[0].json.type).toBe("llm-models");

    const rate = JSON.parse(items[1].json.requestBody as string);
    expect(rate.jpyPerUsd).toBe(150);
    // jpyPerEur = JPY / EUR = 150 / 0.92 ≈ 163.04
    expect(rate.jpyPerEur).toBeCloseTo(150 / 0.92, 1);
    expect(items[1].json.type).toBe("exchange-rate");
  });

  it("pricing未設定のモデルは除外される", () => {
    stubMergedInput([
      {
        name: "No Price Model",
        model_creator: { name: "Anthropic" },
        pricing: {},
        evaluations: { artificial_analysis_intelligence_index: 80 },
      },
    ]);

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(0);
  });

  it("スコア15未満のモデルは除外される", () => {
    stubMergedInput([makeModel({ name: "Weak Model", score: 10 })]);

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(0);
  });

  it("同一ファミリーの複数モデルはスコア最高のみ残る", () => {
    stubMergedInput([
      makeModel({ name: "Gemini 3.1 Flash", creator: "Google", score: 70 }),
      makeModel({ name: "Gemini 3.2 Flash", creator: "Google", score: 75 }),
    ]);

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    // Gemini Flash ファミリーは1つにデデュプ
    expect(models.length).toBe(1);
    expect(models[0].score).toBe(75);
  });

  it("同一シリーズの旧バージョンはスコアが高くても除外される", () => {
    // AA は旧モデルも評価し続けるため、新版が出たら旧版を送らない
    stubMergedInput([
      makeModel({ name: "Claude Opus 4.7 (Adaptive Reasoning)", score: 40 }),
      makeModel({ name: "Claude Opus 5.5 (Max Effort)", score: 57 }),
      makeModel({ name: "Claude 4.5 Sonnet (Reasoning)", score: 60 }),
      makeModel({ name: "Claude Sonnet 5.5 (Max Effort)", score: 56 }),
      makeModel({ name: "Claude 4.5 Haiku", score: 17 }),
    ]);

    const items = callAndGetItems();
    const names = JSON.parse(items[0].json.requestBody as string).map(
      (m: { modelName: string }) => m.modelName,
    );
    expect(names).toEqual([
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
      "Claude 4.5 Haiku",
    ]);
  });

  describe("ベンダー公式の廃止一覧", () => {
    const deprecations = [
      {
        vendor: "xai",
        id: "grok-4-fast-reasoning",
        retireAt: "2026-05-15T20:00:00.000Z",
      },
      { vendor: "openai", id: "o4-mini", retireAt: "2026-10-24T12:00:00.000Z" },
    ];
    const aa = [
      makeModel({ name: "Grok 4 Fast (Reasoning)", creator: "xAI", score: 30 }),
      makeModel({ name: "o4-mini (high)", creator: "OpenAI", score: 30 }),
      makeModel({ name: "Grok 4.7", creator: "xAI", score: 40 }),
    ];

    afterEach(() => {
      vi.useRealTimers();
    });

    it("停止日を過ぎたモデルだけ送らない", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
      stubMergedInput(aa, { JPY: 150 }, deprecations);
      const items = callAndGetItems();
      const names = JSON.parse(items[0].json.requestBody as string).map(
        (m: { modelName: string }) => m.modelName,
      );
      expect(names).toEqual(["Grok 4.7", "o4-mini"]);
      expect(items[0].json.retiredExcluded).toEqual([
        "Grok 4 Fast (Reasoning) (grok-4-fast-reasoning, 2026-05-15T20:00:00.000Z)",
      ]);
    });

    it("停止日を過ぎると次の実行から送らない", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-25T18:00:00Z"));
      stubMergedInput(aa, { JPY: 150 }, deprecations);
      const names = JSON.parse(
        callAndGetItems()[0].json.requestBody as string,
      ).map((m: { modelName: string }) => m.modelName);
      expect(names).toEqual(["Grok 4.7"]);
    });

    it("廃止一覧が壊れていても LLM 一覧と為替は出力する（除外なし）", () => {
      stubMergedInput(aa, { JPY: 150 }, [
        { vendor: "openai", id: null, retireAt: "2026-01-01T00:00:00.000Z" },
      ]);
      const items = callAndGetItems();
      expect(items).toHaveLength(2);
      expect(JSON.parse(items[0].json.requestBody as string)).toHaveLength(3);
      expect(String((items[0].json.retiredExcluded as string[])[0])).toContain(
        "廃止一覧を使えず除外なし",
      );
    });

    it("廃止一覧が無い（テストモード・取得失敗）場合は何も除外しない", () => {
      stubMergedInput(aa);
      const items = callAndGetItems();
      expect(JSON.parse(items[0].json.requestBody as string)).toHaveLength(3);
      expect(items[0].json.retiredExcluded).toEqual([]);
    });
  });

  it("未知プロバイダのモデルは除外される", () => {
    stubMergedInput([makeModel({ creator: "UnknownCorp" })]);

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(0);
  });
});

describe("shouldSkip", () => {
  it.each([
    "Mixtral 8x7B",
    "Ministral 3B",
    "GPT-3.5 Turbo",
    "Llama 2 70B",
    "o1-preview",
    "o1-pro",
    "Mistral Small",
    "Claude 4 Opus",
    "Qwen3 VL",
    "Qwen3 8B",
    "GLM-4V Plus",
    "Nova 2.1 Omni",
    "Kimi K2.7 Code",
    "Grok Code Fast 1",
  ])("'%s' はスキップされる", (name) => {
    expect(shouldSkip(name)).toBe(true);
  });

  it.each([
    "Claude 4.5 Sonnet",
    "GPT-4o",
    "Gemini 3.2 Flash",
    "Llama 4 Maverick",
    "Llama 3.3 70B",
    "DeepSeek V3",
  ])("'%s' はスキップされない", (name) => {
    expect(shouldSkip(name)).toBe(false);
  });
});

describe("familyKey", () => {
  it.each([
    ["GPT-5", "GPT-5"],
    ["GPT-5.5", "GPT-5"],
    ["Gemini 3.1 Flash", "Gemini 3 Flash"],
    ["Gemini 3.2 Flash", "Gemini 3 Flash"],
    ["Gemini 3.5 Flash-Lite", "Gemini 3 Flash-Lite"],
    ["DeepSeek V3 0324", "DeepSeek V3"],
    ["DeepSeek R1 0528", "DeepSeek R1"],
    ["Kimi K2.5 (2025-07)", "Kimi K2.5"],
    ["Kimi K2 (2025-05)", "Kimi K2"],
    ["MiniMax-M2.5", "MiniMax-M2"],
    ["MiniMax M2", "MiniMax-M2"],
    ["Claude 4.5 Sonnet (2025-10-22)", "Claude 4.5 Sonnet"],
  ])("'%s' → '%s'", (input, expected) => {
    expect(familyKey(input)).toBe(expected);
  });
});

describe("seriesOf", () => {
  it.each([
    ["Claude Opus 4.7", "claude opus", 4.7],
    ["Claude 4.5 Sonnet", "claude sonnet", 4.5],
    ["Claude Sonnet 5.5", "claude sonnet", 5.5],
    ["GPT-5.6 Sol", "gpt sol", 5.6],
    ["GPT-6.1 Sol", "gpt sol", 6.1],
    ["GPT-5 mini", "gpt mini", 5],
    ["Gemini 3.1 Pro Preview", "gemini pro", 3.1],
    ["Gemini 3.5 Flash-Lite", "flash gemini lite", 3.5],
    ["Qwen3.8 Max", "max qwen", 3.8],
    ["Qwen3.6 27B", "27b qwen", 3.6],
    ["Kimi K2.6", "k kimi", 2.6],
    ["MiniMax-M2.5", "m minimax", 2.5],
    ["MiMo-V2.6-Pro", "mimo pro v", 2.6],
    ["DeepSeek V4 Flash 0731", "deepseek flash v", 4],
    // 4.20 は 4.2 として扱う（4.7 より旧）
    ["Grok 4.20", "grok", 4.2],
    // 末尾の " v2" は同一版の改訂なのでシリーズ名に含めない
    ["Grok 4.20 0309 v2", "grok", 4.2],
    ["o3", "o", 3],
    ["Kimi K2 Thinking", "k kimi", 2],
    ["Qwen3 Max Thinking", "max qwen", 3],
  ])("'%s' → series '%s' / version %s", (name, series, version) => {
    expect(seriesOf(name)).toEqual({ series, version });
  });

  it("版番号を含まない名前は null", () => {
    expect(seriesOf("Muse Glimmer")).toBeNull();
    expect(seriesOf("Nova Premier")).toBeNull();
  });
});

describe("dropSuperseded", () => {
  it("シリーズ内の最新版だけ残し、別シリーズと版番号なしは残す", () => {
    const names = [
      "GPT-5.6 Sol",
      "GPT-6 Sol",
      "GPT-6.1 Sol",
      "GPT-5.6 Terra",
      "Gemini 3.7 Flash",
      "Gemini 3.8 Flash",
      "Gemini 3.5 Flash-Lite",
      "Muse Glimmer",
    ];
    const kept = dropSuperseded(names.map((name) => ({ name }))).map(
      (m) => m.name,
    );
    expect(kept).toEqual([
      "GPT-6.1 Sol",
      "GPT-5.6 Terra",
      "Gemini 3.8 Flash",
      "Gemini 3.5 Flash-Lite",
      "Muse Glimmer",
    ]);
  });

  it("同じ版の派生（推論強度違い）は全て残す", () => {
    const kept = dropSuperseded([
      { name: "Claude Opus 5.5 (High Effort)" },
      { name: "Claude Opus 5.5 (Max Effort)" },
      { name: "Claude Opus 5 (Max Effort)" },
    ]).map((m) => m.name);
    expect(kept).toEqual([
      "Claude Opus 5.5 (High Effort)",
      "Claude Opus 5.5 (Max Effort)",
    ]);
  });
});
