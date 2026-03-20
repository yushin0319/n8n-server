import { beforeEach, describe, expect, it, vi } from "vitest";
import arXivFallback from "./ArXivFallback";

function callAndGetItems() {
  const result = arXivFallback();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ArXivFallback", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("1件の配列を返す", () => {
    const items = callAndGetItems();
    expect(items).toHaveLength(1);
  });

  it("source が arxiv で url が空のアイテムを返す", () => {
    const items = callAndGetItems();
    expect(items[0].json.source).toBe("arxiv");
    expect(items[0].json.url).toBe("");
  });
});
