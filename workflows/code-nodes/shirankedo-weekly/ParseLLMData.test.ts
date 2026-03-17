import { describe, expect, it, vi, beforeEach } from "vitest";
import parseLLMData, { shouldSkip, familyKey } from "./ParseLLMData";
import type { FilteredModel } from "./ParseLLMData";

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
    vi.stubGlobal("$", (name: string) => ({
      first: () => {
        if (name === "FetchAAModels") {
          return {
            json: {
              data: [
                makeModel({ name: "Claude 4.5 Sonnet", score: 85 }),
                makeModel({ name: "GPT-4o", creator: "OpenAI", score: 80 }),
              ],
            },
          };
        }
        // FetchExchangeRate
        return { json: { rates: { JPY: 150 } } };
      },
    }));

    const items = callAndGetItems();
    // [0] = LLMモデル, [1] = 為替レート
    expect(items).toHaveLength(2);

    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(2);
    expect(models[0].score).toBeGreaterThanOrEqual(models[1].score);
    expect(items[0].json.type).toBe("llm-models");

    const rate = JSON.parse(items[1].json.requestBody as string);
    expect(rate.jpyPerUsd).toBe(150);
    expect(items[1].json.type).toBe("exchange-rate");
  });

  it("pricing未設定のモデルは除外される", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => {
        if (name === "FetchAAModels") {
          return {
            json: {
              data: [
                {
                  name: "No Price Model",
                  model_creator: { name: "Anthropic" },
                  pricing: {},
                  evaluations: { artificial_analysis_intelligence_index: 80 },
                },
              ],
            },
          };
        }
        return { json: { rates: { JPY: 150 } } };
      },
    }));

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(0);
  });

  it("スコア15未満のモデルは除外される", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => {
        if (name === "FetchAAModels") {
          return {
            json: {
              data: [makeModel({ name: "Weak Model", score: 10 })],
            },
          };
        }
        return { json: { rates: { JPY: 150 } } };
      },
    }));

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    expect(models.length).toBe(0);
  });

  it("同一ファミリーの複数モデルはスコア最高のみ残る", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => {
        if (name === "FetchAAModels") {
          return {
            json: {
              data: [
                makeModel({ name: "Gemini 3.1 Flash", creator: "Google", score: 70 }),
                makeModel({ name: "Gemini 3.2 Flash", creator: "Google", score: 75 }),
              ],
            },
          };
        }
        return { json: { rates: { JPY: 150 } } };
      },
    }));

    const items = callAndGetItems();
    const models = JSON.parse(items[0].json.requestBody as string);
    // Gemini Flash ファミリーは1つにデデュプ
    expect(models.length).toBe(1);
    expect(models[0].score).toBe(75);
  });

  it("未知プロバイダのモデルは除外される", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => {
        if (name === "FetchAAModels") {
          return {
            json: {
              data: [makeModel({ creator: "UnknownCorp" })],
            },
          };
        }
        return { json: { rates: { JPY: 150 } } };
      },
    }));

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
    ["Claude 4.5 Sonnet (2025-10-22)", "Claude 4.5 Sonnet"],
  ])("'%s' → '%s'", (input, expected) => {
    expect(familyKey(input)).toBe(expected);
  });
});
