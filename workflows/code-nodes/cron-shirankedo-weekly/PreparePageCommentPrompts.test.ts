import { beforeEach, describe, expect, it, vi } from "vitest";
import preparePageCommentPrompts from "./PreparePageCommentPrompts";

function callAndGetItems() {
  const result = preparePageCommentPrompts();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

const mockTrendRanking = [
  {
    repo: "vercel/next.js",
    displayName: "Next.js",
    description: "Reactフレームワーク",
    language: "TypeScript",
    stars: 130000,
    diff: 1500,
  },
  {
    repo: "ollama/ollama",
    displayName: "Ollama",
    description: "LLM実行基盤",
    language: "Go",
    stars: 80000,
    diff: 1200,
  },
];

describe("PreparePageCommentPrompts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("$input.first()からトレンドランキングを受け取る", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: mockTrendRanking } }),
      all: () => [{ json: { data: mockTrendRanking } }],
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(true);
    expect(items[0].json.trendPrompt).toBeDefined();
  });

  it("プロンプトにトレンドリポのdisplayNameが含まれる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: mockTrendRanking } }),
      all: () => [{ json: { data: mockTrendRanking } }],
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("Next.js");
    expect(prompt).toContain("Ollama");
  });

  it("プロンプトにstar差分情報が含まれる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: mockTrendRanking } }),
      all: () => [{ json: { data: mockTrendRanking } }],
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("1,500");
    expect(prompt).toContain("1,200");
  });

  it("プロンプトの主軸がトレンドリポになっている", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: mockTrendRanking } }),
      all: () => [{ json: { data: mockTrendRanking } }],
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("トレンド TOP10");
  });

  it("トレンドランキングが空の場合にhasSummaries=falseを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: [] } }),
      all: () => [{ json: { data: [] } }],
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(false);
  });

  it("$input.first()がundefinedでもhasSummaries=falseを返す", () => {
    vi.stubGlobal("$input", {
      first: () => undefined,
      all: () => [],
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(false);
  });
});
