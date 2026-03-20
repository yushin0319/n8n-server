import { beforeEach, describe, expect, it, vi } from "vitest";
import buildGraphQLBatches from "./BuildGraphQLBatches";

function callAndGetItems() {
  const result = buildGraphQLBatches();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("BuildGraphQLBatches", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("リポジトリリストからGraphQLバッチクエリを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { data: [{ repo: "facebook/react" }, { repo: "vuejs/core" }] },
      }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    const query = items[0].json.query as string;
    expect(query).toContain("facebook");
    expect(query).toContain("react");
    expect(query).toContain("vuejs");
    expect(query).toContain("core");
    expect(query).toContain("releases(first: 5");
    expect(items[0].json.batchIndex).toBe(0);
  });

  it("40リポごとにバッチ分割する", () => {
    const repos = Array.from({ length: 85 }, (_, i) => ({
      repo: `owner/repo-${i}`,
    }));
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: repos } }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(3); // 40 + 40 + 5
    expect(items[0].json.batchIndex).toBe(0);
    expect(items[1].json.batchIndex).toBe(1);
    expect(items[2].json.batchIndex).toBe(2);
  });

  it("空のリポリストはempty結果を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { data: [] } }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0].json.empty).toBe(true);
    expect(items[0].json.count).toBe(0);
  });

  it("スラッシュのないリポ名は除外する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { data: [{ repo: "invalid-repo" }, { repo: "valid/repo" }] },
      }),
    });

    const items = callAndGetItems();
    const query = items[0].json.query as string;
    expect(query).not.toContain("invalid-repo");
    expect(query).toContain("valid");
  });

  it("文字列のリポ名もサポートする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { data: ["owner/repo-a", "owner/repo-b"] },
      }),
    });

    const items = callAndGetItems();
    const query = items[0].json.query as string;
    expect(query).toContain("repo-a");
    expect(query).toContain("repo-b");
  });

  it("レスポンスがdata未指定の場合もフォールバックする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: [{ repo: "owner/repo" }],
      }),
    });

    const items = callAndGetItems();
    const query = items[0].json.query as string;
    expect(query).toContain("owner");
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
