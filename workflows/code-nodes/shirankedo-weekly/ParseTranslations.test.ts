import { describe, expect, it, vi, beforeEach } from "vitest";
import parseTranslations from "./ParseTranslations";

function callAndGetItems() {
  const result = parseTranslations();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("ParseTranslations", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("50件ずつチャンクに分割して返す", () => {
    const repos: IDataObject[] = [];
    for (let i = 0; i < 75; i++) {
      repos.push({ repo: `owner/repo-${i}`, displayName: `Repo ${i}`, description: "desc", language: "TS", stars: 100 });
    }
    staticData.translations = repos;

    const items = callAndGetItems();
    expect(items).toHaveLength(2);
    expect(items[0].json.count).toBe(50);
    expect(items[1].json.count).toBe(25);
    expect(items[0].json.totalRepos).toBe(75);
  });

  it("star情報をstaticDataに保存する", () => {
    staticData.translations = [
      { repo: "owner/repo1", stars: 500 },
      { repo: "owner/repo2", stars: 1000 },
    ];

    parseTranslations();
    const newStars = staticData.newRepoStars as IDataObject[];
    expect(newStars).toHaveLength(2);
    expect(newStars[0]).toEqual({ repo: "owner/repo1", stars: 500 });
  });

  it("翻訳が空の場合は空を返す", () => {
    staticData.translations = [];

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.count).toBe(0);
    expect(items[0].json.requestBody).toBe("[]");
  });
});
