import { beforeEach, describe, expect, it, vi } from "vitest";
import accumulateStars from "./AccumulateStars";

describe("AccumulateStars", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("GraphQL結果からstar数を蓄積する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: { nameWithOwner: "owner/repo1", stargazerCount: 100 },
            repo1: { nameWithOwner: "owner/repo2", stargazerCount: 200 },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    const stars = staticData.stars as IDataObject[];
    expect(stars).toHaveLength(2);
    expect(stars[0]).toEqual({ repo: "owner/repo1", stars: 100 });
    expect(stars[1]).toEqual({ repo: "owner/repo2", stars: 200 });
  });

  it("nullのリポをスキップする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: null,
            repo1: { nameWithOwner: "owner/repo1", stargazerCount: 50 },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    expect(staticData.stars).toHaveLength(1);
  });

  it("nameWithOwnerがないリポをスキップする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: { stargazerCount: 999 },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    expect(staticData.stars).toHaveLength(0);
  });

  it("初回バッチで前回失敗時のゴミデータをクリアする", () => {
    // 前回失敗時のゴミデータが残っている状態をシミュレート
    staticData.stars = [{ repo: "stale/data", stars: 999 }];
    // _starsInitializedフラグなし = 新しいWF実行の初回バッチ

    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: { nameWithOwner: "owner/fresh", stargazerCount: 10 },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    const stars = staticData.stars as IDataObject[];
    // ゴミデータがクリアされ、新しいデータのみ
    expect(stars).toHaveLength(1);
    expect(stars[0]).toEqual({ repo: "owner/fresh", stars: 10 });
  });

  it("2回目以降のバッチではデータを蓄積する", () => {
    // 初回バッチ済み
    staticData._starsInitialized = true;
    staticData.stars = [{ repo: "owner/batch1", stars: 100 }];
    staticData.renames = [];

    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: { nameWithOwner: "owner/batch2", stargazerCount: 200 },
          },
          repoMap: { repo0: "owner/batch2" },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    const stars = staticData.stars as IDataObject[];
    expect(stars).toHaveLength(2);
  });

  it("nameWithOwnerが元と同じならrenamesに追加されない", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            r0: { nameWithOwner: "owner/repo1", stargazerCount: 100 },
          },
          repoMap: { r0: "owner/repo1" },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    expect(staticData.renames).toHaveLength(0);
  });

  it("nameWithOwnerが元と異なればrenamesに追加される", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            r0: { nameWithOwner: "new-owner/new-repo", stargazerCount: 100 },
          },
          repoMap: { r0: "old-owner/old-repo" },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    const renames = staticData.renames as IDataObject[];
    expect(renames).toHaveLength(1);
    expect(renames[0]).toEqual({
      from: "old-owner/old-repo",
      to: "new-owner/new-repo",
    });
  });

  it("nullリポはrenamesにもstarsにも追加されない", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            r0: null,
          },
          repoMap: { r0: "owner/repo1" },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    expect(staticData.stars).toHaveLength(0);
    expect(staticData.renames).toHaveLength(0);
  });

  it("初回バッチでrenamesもクリアする", () => {
    staticData.renames = [{ from: "stale/old", to: "stale/new" }];

    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            r0: { nameWithOwner: "new-owner/repo", stargazerCount: 10 },
          },
          repoMap: { r0: "old-owner/repo" },
        },
      }),
      all: () => [{ json: {} }],
    });

    accumulateStars();
    const renames = staticData.renames as IDataObject[];
    // ゴミデータがクリアされ、新しいリネームのみ
    expect(renames).toHaveLength(1);
    expect(renames[0]).toEqual({
      from: "old-owner/repo",
      to: "new-owner/repo",
    });
  });
});
