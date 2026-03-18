import { beforeEach, describe, expect, it, vi } from "vitest";
import parseSearchResults from "./ParseSearchResults";

function callAndGetItems() {
  const result = parseSearchResults();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("ParseSearchResults", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchExistingRepos") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });
  });

  it("既存リポを除外する", () => {
    staticData.searchRepos = [
      { repo: "owner/existing", language: "TypeScript" },
      { repo: "owner/new-repo", language: "Rust" },
    ];
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchExistingRepos") {
        return {
          first: () => ({
            json: { data: [{ repo: "owner/existing" }] },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.hasNewRepos).toBe(true);
    expect(items[0].json.count).toBe(1);
  });

  it("ブロックリストのリポを除外する", () => {
    staticData.searchRepos = [
      { repo: "owner/awesome-tools", language: "Python" },
      { repo: "owner/legit-project", language: "Go" },
    ];

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(1);
  });

  it("重複リポをデデュプする", () => {
    staticData.searchRepos = [
      { repo: "owner/repo1", language: "TypeScript" },
      { repo: "owner/repo1", language: "TypeScript" },
      { repo: "OWNER/REPO1", language: "TypeScript" },
    ];

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(1);
  });

  it("新規リポがない場合はhasNewRepos=falseを返す", () => {
    staticData.searchRepos = [];

    const items = callAndGetItems();
    expect(items[0].json.hasNewRepos).toBe(false);
    expect(items[0].json.count).toBe(0);
  });

  it("20件超のリポをバッチ化する", () => {
    const repos: IDataObject[] = [];
    for (let i = 0; i < 25; i++) {
      repos.push({ repo: `owner/repo-${i}`, language: "TypeScript" });
    }
    staticData.searchRepos = repos;

    const items = callAndGetItems();
    expect(items[0].json.hasNewRepos).toBe(true);
    expect(items[0].json.totalBatches).toBe(2);
    const batches = items[0].json.batches as IDataObject[][];
    expect(batches[0]).toHaveLength(20);
    expect(batches[1]).toHaveLength(5);
  });
});
