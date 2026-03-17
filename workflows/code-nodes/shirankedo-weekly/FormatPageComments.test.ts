import { describe, expect, it, vi, beforeEach } from "vitest";
import formatPageComments from "./FormatPageComments";

function callAndGetItems() {
  const result = formatPageComments();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("FormatPageComments", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("3件のコメントを含むJSONを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "サブコメント" }] } },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatAIApiComment") {
        return {
          first: () => ({
            json: {
              trendComment: "トレンドコメント",
              aiApiComment: "AIコメント",
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const comments = JSON.parse(items[0].json.requestBody as string);
    expect(comments).toHaveLength(3);
    expect(items[0].json.count).toBe(3);
  });

  it("trend, ai_api, ai_subの3タイプを含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [
            { content: { parts: [{ text: "sub text" }] } },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatAIApiComment") {
        return {
          first: () => ({
            json: {
              trendComment: "trend",
              aiApiComment: "ai_api",
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const comments = JSON.parse(items[0].json.requestBody as string);
    const types = comments.map((c: any) => c.type);
    expect(types).toEqual(["trend", "ai_api", "ai_sub"]);
  });
});
