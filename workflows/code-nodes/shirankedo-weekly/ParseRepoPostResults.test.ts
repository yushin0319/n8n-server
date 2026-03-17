import { describe, expect, it, vi, beforeEach } from "vitest";
import parseRepoPostResults from "./ParseRepoPostResults";

function callAndGetItems() {
  const result = parseRepoPostResults();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("ParseRepoPostResults", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("結果とstar情報を返す", () => {
    staticData.repoPostResults = { total: 10, errors: 1 };
    staticData.newRepoStars = [
      { repo: "owner/repo1", stars: 100 },
      { repo: "owner/repo2", stars: 200 },
    ];

    const items = callAndGetItems();
    expect(items[0].json.total).toBe(10);
    expect(items[0].json.errors).toBe(1);
    expect(items[0].json.starCount).toBe(2);
    const stars = JSON.parse(items[0].json.starRequestBody as string);
    expect(stars).toHaveLength(2);
  });

  it("読み出し後にstaticDataをクリアする", () => {
    staticData.repoPostResults = { total: 5, errors: 0 };
    staticData.newRepoStars = [{ repo: "a/b", stars: 10 }];

    parseRepoPostResults();
    expect(staticData.repoPostResults).toBeNull();
    expect(staticData.newRepoStars).toBeNull();
  });

  it("未設定の場合はデフォルト値を返す", () => {
    const items = callAndGetItems();
    expect(items[0].json.total).toBe(0);
    expect(items[0].json.errors).toBe(0);
    expect(items[0].json.starCount).toBe(0);
  });
});
