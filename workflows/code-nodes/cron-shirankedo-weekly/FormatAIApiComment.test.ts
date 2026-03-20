import { beforeEach, describe, expect, it, vi } from "vitest";
import formatAIApiComment from "./FormatAIApiComment";

function callAndGetItems() {
  const result = formatAIApiComment();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("FormatAIApiComment", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Geminiレスポンスからコメントテキストを抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "AIコメントテキスト" }] } },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatTrendComment") {
        return {
          first: () => ({
            json: {
              trendComment: "トレンドコメント",
              aiSubPrompt: "サブプロンプト",
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.aiApiComment).toBe("AIコメントテキスト");
  });

  it("レスポンスが空の場合に生成失敗を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatTrendComment") {
        return {
          first: () => ({
            json: { trendComment: "tc", aiSubPrompt: "sp" },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.aiApiComment).toBe("生成失敗");
  });

  it("前ノードのフィールドを引き継ぐ", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [{ content: { parts: [{ text: "text" }] } }],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatTrendComment") {
        return {
          first: () => ({
            json: {
              trendComment: "prev trend",
              aiSubPrompt: "prev sub prompt",
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.trendComment).toBe("prev trend");
    expect(items[0].json.aiSubPrompt).toBe("prev sub prompt");
  });
});
