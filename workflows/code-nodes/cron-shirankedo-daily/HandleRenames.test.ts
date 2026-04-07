import { beforeEach, describe, expect, it, vi } from "vitest";
import handleRenames from "./HandleRenames";

function callAndGetItems() {
  const result = handleRenames();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("HandleRenames", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("renamesがあればrequestBodyに含まれる", () => {
    staticData.renames = [
      { from: "old-owner/repo1", to: "new-owner/repo1" },
      { from: "old-owner/repo2", to: "new-owner/repo2" },
    ];

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.skip).toBe(false);
    expect(items[0].json.count).toBe(2);
    const body = JSON.parse(items[0].json.requestBody as string);
    expect(body.renames).toEqual([
      { from: "old-owner/repo1", to: "new-owner/repo1" },
      { from: "old-owner/repo2", to: "new-owner/repo2" },
    ]);
    // staticDataがクリアされていること
    expect(staticData.renames).toEqual([]);
  });

  it("renamesが空ならskip: trueを返す", () => {
    staticData.renames = [];

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.skip).toBe(true);
    expect(items[0].json.count).toBe(0);
    expect(items[0].json.renames).toEqual([]);
  });

  it("renamesがundefinedでもskip: trueを返す", () => {
    // staticData.renames を設定しない

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.skip).toBe(true);
    expect(items[0].json.count).toBe(0);
  });
});
