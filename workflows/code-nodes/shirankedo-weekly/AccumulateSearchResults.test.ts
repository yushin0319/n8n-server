import { describe, expect, it, vi, beforeEach } from "vitest";
import accumulateSearchResults from "./AccumulateSearchResults";

describe("AccumulateSearchResults", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("検索結果をstaticDataに蓄積する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          items: [
            {
              full_name: "owner/repo1",
              name: "repo1",
              description: "A cool tool",
              language: "TypeScript",
              stargazers_count: 1000,
            },
          ],
        },
      }),
      all: () => [{ json: { items: [] } }],
    });

    accumulateSearchResults();
    const repos = staticData.searchRepos as IDataObject[];
    expect(repos).toHaveLength(1);
    expect(repos[0].repo).toBe("owner/repo1");
    expect(repos[0].stars).toBe(1000);
  });

  it("itemsが空の場合でもエラーにならない", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { items: [] } }),
      all: () => [{ json: { items: [] } }],
    });

    accumulateSearchResults();
    expect(staticData.searchRepos).toEqual([]);
  });

  it("全フィールドを正しく抽出する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          items: [
            {
              full_name: "org/tool",
              name: "tool",
              description: "desc here",
              language: "Rust",
              stargazers_count: 500,
            },
          ],
        },
      }),
      all: () => [{ json: { items: [] } }],
    });

    accumulateSearchResults();
    const r = (staticData.searchRepos as IDataObject[])[0];
    expect(r.repo).toBe("org/tool");
    expect(r.name).toBe("tool");
    expect(r.description).toBe("desc here");
    expect(r.language).toBe("Rust");
    expect(r.stars).toBe(500);
  });
});
