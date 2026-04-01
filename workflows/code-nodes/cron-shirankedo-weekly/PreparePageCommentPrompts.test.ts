import { beforeEach, describe, expect, it, vi } from "vitest";
import preparePageCommentPrompts from "./PreparePageCommentPrompts";

function callAndGetItems() {
  const result = preparePageCommentPrompts();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

const mockSummaries = [
  { content: "今週のサマリー1" },
  { content: "今週のサマリー2" },
];

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

  it("$input.all()からサマリーとトレンドランキングを受け取る", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { data: mockSummaries } },
        { json: { data: mockTrendRanking } },
      ],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(true);
    expect(items[0].json.trendPrompt).toBeDefined();
  });

  it("プロンプトにトレンドリポのdisplayNameが含まれる", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { data: mockSummaries } },
        { json: { data: mockTrendRanking } },
      ],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("Next.js");
    expect(prompt).toContain("Ollama");
  });

  it("プロンプトにstar差分情報が含まれる", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { data: mockSummaries } },
        { json: { data: mockTrendRanking } },
      ],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("1,500");
    expect(prompt).toContain("1,200");
  });

  it("プロンプトの主軸がトレンドリポになっている（週次レポートは参考扱い）", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { data: mockSummaries } },
        { json: { data: mockTrendRanking } },
      ],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    const prompt = items[0].json.trendPrompt as string;
    expect(prompt).toContain("トレンド TOP10");
    expect(prompt).toContain("参考");
  });

  it("トレンドランキングが空でもサマリーがあればhasSummaries=true", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: { data: mockSummaries } }, { json: { data: [] } }],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(true);
    expect(items[0].json.trendPrompt).toContain("ランキングデータなし");
  });

  it("サマリーがなくてもトレンドランキングがあればプロンプト生成する", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: { data: [] } }, { json: { data: mockTrendRanking } }],
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(true);
    expect(items[0].json.trendPrompt).toContain("Next.js");
  });

  it("サマリーもランキングもない場合にhasSummaries=falseを返す", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: { data: [] } }, { json: { data: [] } }],
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.hasSummaries).toBe(false);
  });

  it("サマリー内容もプロンプトに含まれる", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { data: mockSummaries } },
        { json: { data: mockTrendRanking } },
      ],
      first: () => ({ json: { data: mockSummaries } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.trendPrompt).toContain("今週のサマリー1");
  });
});
