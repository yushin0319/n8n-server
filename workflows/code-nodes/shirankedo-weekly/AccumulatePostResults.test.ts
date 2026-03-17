import { describe, expect, it, vi, beforeEach } from "vitest";
import accumulatePostResults from "./AccumulatePostResults";

describe("AccumulatePostResults", () => {
  let staticData: IDataObject;

  beforeEach(() => {
    vi.unstubAllGlobals();
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", () => staticData);
  });

  it("成功レスポンスでtotalを加算する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true, inserted: 5 } }),
      all: () => [{ json: { ok: true, inserted: 5 } }],
    });

    accumulatePostResults();
    expect((staticData.postResults as any).total).toBe(5);
    expect((staticData.postResults as any).errors).toBe(0);
  });

  it("失敗レスポンスでerrorsを加算する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false } }),
      all: () => [{ json: { ok: false } }],
    });

    accumulatePostResults();
    expect((staticData.postResults as any).total).toBe(0);
    expect((staticData.postResults as any).errors).toBe(1);
  });

  it("複数回呼び出しで累積される", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true, inserted: 3 } }),
      all: () => [{ json: { ok: true, inserted: 3 } }],
    });

    accumulatePostResults();
    accumulatePostResults();

    expect((staticData.postResults as any).total).toBe(6);
  });
});
