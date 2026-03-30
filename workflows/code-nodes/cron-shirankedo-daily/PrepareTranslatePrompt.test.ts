import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareTranslatePrompt from "./PrepareTranslatePrompt";

function callAndGetItems() {
  const result = prepareTranslatePrompt();
  return (Array.isArray(result) ? result : [result]) as INodeExecutionData[];
}

describe("PrepareTranslatePrompt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("バッチごとに1アイテムを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          batches: [
            [{ repo: "owner/repo1", description: "A tool" }],
            [{ repo: "owner/repo2", description: "Another tool" }],
          ],
        },
      }),
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(2);
    expect(items[0].json.batchIndex).toBe(0);
    expect(items[1].json.batchIndex).toBe(1);
  });

  it("各アイテムにreposとpromptが含まれる", () => {
    const batch = [
      { repo: "owner/repo1", description: "Cool project" },
      { repo: "owner/repo2", description: "Nice lib" },
    ];
    vi.stubGlobal("$input", {
      first: () => ({
        json: { batches: [batch] },
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.repos).toEqual(batch);
    expect(items[0].json.prompt).toContain("owner/repo1");
    expect(items[0].json.prompt).toContain("owner/repo2");
  });
});
