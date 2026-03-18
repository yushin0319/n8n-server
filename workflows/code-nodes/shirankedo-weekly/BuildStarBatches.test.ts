import { beforeEach, describe, expect, it, vi } from "vitest";
import buildStarBatches from "./BuildStarBatches";

function callAndGetItems() {
  const result = buildStarBatches();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("BuildStarBatches", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("空のリポ一覧ではbatches:[], count:0を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    expect(items[0].json.batches).toEqual([]);
    expect(items[0].json.count).toBe(0);
  });

  it("3リポで1バッチのGraphQLクエリを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: [
            { repo: "owner1/repo1" },
            { repo: "owner2/repo2" },
            { repo: "owner3/repo3" },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);
    const query = items[0].json.query as string;
    expect(query).toContain("r0: repository");
    expect(query).toContain('owner: "owner1"');
    expect(query).toContain('name: "repo1"');
    expect(query).toContain("nameWithOwner stargazerCount");
  });

  it("60リポで2バッチに分割される（50件/バッチ）", () => {
    const repos = Array.from({ length: 60 }, (_, i) => ({
      repo: `owner/repo${i}`,
    }));
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: repos } }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(2);
    expect(items[0].json.batchIndex).toBe(0);
    expect(items[1].json.batchIndex).toBe(1);
    // 2番目のバッチのalias番号は50から始まる
    expect(items[1].json.query as string).toContain("r50:");
  });

  it("リポ名に特殊文字があってもGraphQLインジェクションしない", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: [{ repo: 'evil"owner/repo"name' }],
        },
      }),
    });

    const items = callAndGetItems();
    const query = items[0].json.query as string;
    // 特殊文字が除去されていること
    expect(query).toContain('owner: "evilowner"');
    expect(query).toContain('name: "reponame"');
    expect(query).not.toContain('"owner"');
  });
});
