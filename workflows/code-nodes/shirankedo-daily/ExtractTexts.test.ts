import { beforeEach, describe, expect, it, vi } from "vitest";
import extractTexts from "./ExtractTexts";

function callAndGetItems() {
  const result = extractTexts();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ExtractTexts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("HTMLの p タグからテキストを抽出する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            data: "<p>This is a long enough paragraph text for testing extraction.</p>",
          },
        },
      ],
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "ParseSelection") {
        return {
          all: () => [
            {
              json: {
                url: "https://example.com",
                title: "Test Article",
                source: "hackernews",
                impact: 7,
                isPaper: 0,
              },
            },
          ],
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const combined = items[0].json.items as IDataObject[];

    expect(combined).toHaveLength(1);
    expect(combined[0].fulltext).toContain("This is a long enough paragraph");
    expect(combined[0].url).toBe("https://example.com");
  });

  it("HTMLがない場合は '(本文取得失敗)' を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: {} }],
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "ParseSelection") {
        return {
          all: () => [
            {
              json: {
                url: "https://example.com",
                title: "Test",
                source: "hackernews",
                impact: 5,
                isPaper: 0,
              },
            },
          ],
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const combined = items[0].json.items as IDataObject[];

    expect(combined[0].fulltext).toBe("(本文取得失敗)");
  });

  it("20文字以下の短いパラグラフはフィルタする", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            data: "<p>Short text</p><p>This paragraph is definitely long enough to pass the filter check.</p>",
          },
        },
      ],
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "ParseSelection") {
        return {
          all: () => [
            {
              json: {
                url: "https://example.com",
                title: "Test",
                source: "hackernews",
                impact: 5,
                isPaper: 0,
              },
            },
          ],
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const combined = items[0].json.items as IDataObject[];

    expect(combined[0].fulltext).not.toContain("Short text");
    expect(combined[0].fulltext).toContain(
      "This paragraph is definitely long enough",
    );
  });
});
