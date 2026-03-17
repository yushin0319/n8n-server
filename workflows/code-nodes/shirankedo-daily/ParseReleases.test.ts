import { describe, expect, it, vi, beforeEach } from "vitest";
import parseReleases from "./ParseReleases";

function callAndGetItems() {
  const result = parseReleases();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ParseReleases", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("蓄積されたリリースを返す", () => {
    staticData.releases = [
      { repo: "facebook/react", tag: "v19.0.0", version: "19.0.0", type: "major" },
      { repo: "vuejs/core", tag: "v3.5.0", version: "3.5.0", type: "minor" },
    ];

    const items = callAndGetItems();

    expect(items[0].json.count).toBe(2);
    const releases = items[0].json.releases as IDataObject[];
    expect(releases).toHaveLength(2);
    const body = JSON.parse(items[0].json.requestBody as string);
    expect(body).toHaveLength(2);
  });

  it("読み取り後にstaticDataをクリアする", () => {
    staticData.releases = [
      { repo: "facebook/react", tag: "v19.0.0", version: "19.0.0", type: "major" },
    ];

    callAndGetItems();

    expect(staticData.releases).toEqual([]);
  });

  it("リリースが空の場合は0件を返す", () => {
    staticData.releases = [];

    const items = callAndGetItems();

    expect(items[0].json.count).toBe(0);
    expect(items[0].json.releases).toEqual([]);
  });
});
