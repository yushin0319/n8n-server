import { beforeEach, describe, expect, it, vi } from "vitest";
import parseStars from "./ParseStars";

function callAndGetItems() {
  const result = parseStars();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("ParseStars", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("50件ずつチャンクに分割する", () => {
    const stars: IDataObject[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ repo: `owner/repo-${i}`, stars: i * 10 });
    }
    staticData.stars = stars;

    const items = callAndGetItems();
    expect(items).toHaveLength(3);
    expect(items[0].json.count).toBe(50);
    expect(items[1].json.count).toBe(50);
    expect(items[2].json.count).toBe(20);
    expect(items[0].json.totalStars).toBe(120);
  });

  it("starsが空の場合は空チャンクを返す", () => {
    staticData.stars = [];

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.count).toBe(0);
  });
});
