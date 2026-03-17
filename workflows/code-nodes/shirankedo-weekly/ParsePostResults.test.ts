import { describe, expect, it, vi, beforeEach } from "vitest";
import parsePostResults from "./ParsePostResults";

function callAndGetItems() {
  const result = parsePostResults();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("ParsePostResults", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("蓄積された結果を返す", () => {
    staticData.postResults = { total: 10, errors: 2 };

    const items = callAndGetItems();
    expect(items[0].json.total).toBe(10);
    expect(items[0].json.errors).toBe(2);
  });

  it("読み出し後にstaticDataをクリアする", () => {
    staticData.postResults = { total: 5, errors: 0 };

    parsePostResults();
    expect(staticData.postResults).toBeNull();
  });

  it("postResultsが未設定の場合はデフォルト値を返す", () => {
    const items = callAndGetItems();
    expect(items[0].json.total).toBe(0);
    expect(items[0].json.errors).toBe(0);
  });
});
