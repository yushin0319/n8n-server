import { describe, expect, it, vi, beforeEach } from "vitest";
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
});
