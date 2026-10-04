import { beforeEach, describe, expect, it, vi } from "vitest";
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
          candidates: [{ content: { parts: [{ text: "トレンドテキスト" }] } }],
        },
      }),
    });
    const items = callAndGetItems();
    expect(items[0].json.trendComment).toBe("トレンドテキスト");
  });

  // 表示されるのはトレンドページの総評だけ。AI API / AI サブスク用の空プロンプトは引き継がない
  // (2026-10-04 に空プロンプトの Gemini 呼び出しが "Request has empty input" で WF ごと失敗した)
  it("出力は trendComment だけ (他ノードを参照しない)", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [{ content: { parts: [{ text: "text" }] } }],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(Object.keys(items[0].json)).toEqual(["trendComment"]);
  });
});
