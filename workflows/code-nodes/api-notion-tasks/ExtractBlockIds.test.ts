import { beforeEach, describe, expect, it, vi } from "vitest";
import extractBlockIds from "./ExtractBlockIds";

describe("ExtractBlockIds", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("results が空の場合 hasBlocks=false を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: [] } }),
    });

    const result = extractBlockIds() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.hasBlocks).toBe(false);
  });

  it("ブロックごとに hasBlocks=true と blockId を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { results: [{ id: "block-1" }] },
      }),
    });

    const result = extractBlockIds() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.hasBlocks).toBe(true);
    expect(result[0].json.blockId).toBe("block-1");
  });

  it("複数ブロックを処理する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          results: [{ id: "block-1" }, { id: "block-2" }, { id: "block-3" }],
        },
      }),
    });

    const result = extractBlockIds() as INodeExecutionData[];
    expect(result).toHaveLength(3);
    expect(result[0].json.blockId).toBe("block-1");
    expect(result[1].json.blockId).toBe("block-2");
    expect(result[2].json.blockId).toBe("block-3");
    result.forEach((item) => {
      expect(item.json.hasBlocks).toBe(true);
    });
  });
});
