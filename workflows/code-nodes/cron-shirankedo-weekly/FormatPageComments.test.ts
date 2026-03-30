import { beforeEach, describe, expect, it, vi } from "vitest";
import formatPageComments from "./FormatPageComments";

function callAndGetItems() {
  const result = formatPageComments();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("FormatPageComments", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("trendコメント1件のみを含むJSONを返す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatTrendComment") {
        return {
          first: () => ({
            json: { trendComment: "トレンドコメント" },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const comments = JSON.parse(items[0].json.requestBody as string);
    expect(comments).toHaveLength(1);
    expect(items[0].json.count).toBe(1);
    expect(comments[0]).toEqual({ type: "trend", content: "トレンドコメント" });
  });
});
