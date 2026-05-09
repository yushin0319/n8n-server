import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareSummaryPrompt from "./PrepareSummaryPrompt";

function callAndGetItems() {
  const result = prepareSummaryPrompt();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareSummaryPrompt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("アイテムからGemini要約プロンプトを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          items: [
            {
              title: "React 19 Released",
              fulltext: "React 19 is a major update...",
              impact: 8,
            },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);
    const prompt = body.contents[0].parts[0].text;

    expect(prompt).toContain("React 19 Released");
  });

  it("geminiBody が有効なJSONである", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          items: [
            { title: "Test Article", fulltext: "Content here", impact: 5 },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);

    expect(body).toHaveProperty("contents");
    expect(body).toHaveProperty("generationConfig");
  });

  it("responseJsonSchema が generationConfig に含まれる (Gemini 3)", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { items: [{ title: "Article", fulltext: "...", impact: 5 }] },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);

    expect(body.generationConfig.responseMimeType).toBe("application/json");
    const schema = body.generationConfig.responseJsonSchema;
    expect(schema).toBeDefined();
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["summaries"]);
    expect(schema.properties.summaries.type).toBe("array");
    expect(schema.properties.summaries.items.required).toEqual([
      "article_index",
      "tags",
      "title_ja",
      "summary",
      "comment",
    ]);
  });

  it("items をパススルーする", () => {
    const inputItems = [
      { title: "Article A", fulltext: "Text A", impact: 7 },
      { title: "Article B", fulltext: "Text B", impact: 6 },
    ];

    vi.stubGlobal("$input", {
      first: () => ({ json: { items: inputItems } }),
    });

    const items = callAndGetItems();

    expect(items[0].json.items).toEqual(inputItems);
  });
});
