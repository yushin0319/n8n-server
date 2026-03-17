import { describe, expect, it, vi, beforeEach } from "vitest";
import formatTrendComment from "./FormatTrendComment";

function callAndGetItems() {
  const result = formatTrendComment();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("FormatTrendComment", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Geminiレスポンスからトレンドコメントを抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "トレンドテキスト" }] } },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "HasSummariesForComments") {
        return {
          first: () => ({
            json: { aiApiPrompt: "api prompt", aiSubPrompt: "sub prompt" },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.trendComment).toBe("トレンドテキスト");
  });

  it("aiApiPromptとaiSubPromptを引き継ぐ", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "text" }] } },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "HasSummariesForComments") {
        return {
          first: () => ({
            json: { aiApiPrompt: "my api prompt", aiSubPrompt: "my sub prompt" },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.aiApiPrompt).toBe("my api prompt");
    expect(items[0].json.aiSubPrompt).toBe("my sub prompt");
  });
});
