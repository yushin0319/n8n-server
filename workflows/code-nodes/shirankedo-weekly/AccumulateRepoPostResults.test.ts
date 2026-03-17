import { describe, expect, it, vi, beforeEach } from "vitest";
import accumulateRepoPostResults from "./AccumulateRepoPostResults";

describe("AccumulateRepoPostResults", () => {
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

    accumulateRepoPostResults();
    expect((staticData.repoPostResults as any).total).toBe(5);
    expect((staticData.repoPostResults as any).errors).toBe(0);
  });

  it("失敗レスポンスでerrorsを加算する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: false } }),
      all: () => [{ json: { ok: false } }],
    });

    accumulateRepoPostResults();
    expect((staticData.repoPostResults as any).total).toBe(0);
    expect((staticData.repoPostResults as any).errors).toBe(1);
  });

  it("複数回呼び出しで累積される", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { ok: true, inserted: 3 } }),
      all: () => [{ json: { ok: true, inserted: 3 } }],
    });

    accumulateRepoPostResults();
    accumulateRepoPostResults();

    expect((staticData.repoPostResults as any).total).toBe(6);
  });
});
