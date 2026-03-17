import { describe, expect, it, vi, beforeEach } from "vitest";
import accumulateReleases from "./AccumulateReleases";

function callAndGetItems() {
  const result = accumulateReleases();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("AccumulateReleases", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("メジャーリリースをstaticDataに蓄積する", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: {
              nameWithOwner: "facebook/react",
              releases: {
                nodes: [
                  {
                    tagName: "v19.0.0",
                    isPrerelease: false,
                    publishedAt: recentDate,
                    name: "React 19",
                  },
                ],
              },
            },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    callAndGetItems();

    const releases = staticData.releases as IDataObject[];
    expect(releases).toHaveLength(1);
    expect(releases[0].repo).toBe("facebook/react");
    expect(releases[0].type).toBe("major");
    expect(releases[0].version).toBe("19.0.0");
  });

  it("プレリリースはスキップする", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: {
              nameWithOwner: "facebook/react",
              releases: {
                nodes: [
                  {
                    tagName: "v19.0.0-rc.1",
                    isPrerelease: true,
                    publishedAt: recentDate,
                    name: "React 19 RC",
                  },
                ],
              },
            },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    callAndGetItems();

    const releases = staticData.releases as IDataObject[];
    expect(releases).toHaveLength(0);
  });

  it("72時間以上前のリリースはスキップする", () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: {
              nameWithOwner: "facebook/react",
              releases: {
                nodes: [
                  {
                    tagName: "v19.0.0",
                    isPrerelease: false,
                    publishedAt: oldDate,
                    name: "React 19",
                  },
                ],
              },
            },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    callAndGetItems();

    const releases = staticData.releases as IDataObject[];
    expect(releases).toHaveLength(0);
  });

  it("マイナーバージョンを正しく分類する", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: {
              nameWithOwner: "vuejs/core",
              releases: {
                nodes: [
                  {
                    tagName: "v3.5.0",
                    isPrerelease: false,
                    publishedAt: recentDate,
                    name: "Vue 3.5",
                  },
                ],
              },
            },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    callAndGetItems();

    const releases = staticData.releases as IDataObject[];
    expect(releases).toHaveLength(1);
    expect(releases[0].type).toBe("minor");
  });

  it("パッチバージョンはスキップする", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          data: {
            repo0: {
              nameWithOwner: "vuejs/core",
              releases: {
                nodes: [
                  {
                    tagName: "v3.5.1",
                    isPrerelease: false,
                    publishedAt: recentDate,
                    name: "Vue 3.5.1",
                  },
                ],
              },
            },
          },
        },
      }),
      all: () => [{ json: {} }],
    });

    callAndGetItems();

    const releases = staticData.releases as IDataObject[];
    expect(releases).toHaveLength(0);
  });
});
