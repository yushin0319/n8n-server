import { describe, expect, it, vi } from "vitest";
import prepDeleteList from "./PrepDeleteList";

function setupWithIds(ids: string[]) {
  vi.stubGlobal("$", (name: string) => {
    if (name === "PrepUpload") {
      return { first: () => ({ json: { ids } }) };
    }
    throw new Error(`unexpected $ call: ${name}`);
  });
}

function asArray(out: unknown): { json: { id: string } }[] {
  return (Array.isArray(out) ? out : [out]) as { json: { id: string } }[];
}

describe("PrepDeleteList", () => {
  it("PrepUpload の ids 配列を 1 件ずつのアイテムに展開", () => {
    setupWithIds(["10", "20", "30"]);
    const items = asArray(prepDeleteList());
    expect(items).toHaveLength(3);
    expect(items[0].json).toEqual({ id: "10" });
    expect(items[1].json).toEqual({ id: "20" });
    expect(items[2].json).toEqual({ id: "30" });
  });

  it("空 ids なら空配列を返す", () => {
    setupWithIds([]);
    const items = asArray(prepDeleteList());
    expect(items).toEqual([]);
  });
});
