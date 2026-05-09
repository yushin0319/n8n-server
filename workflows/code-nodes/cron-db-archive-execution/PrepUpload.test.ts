import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prepUpload from "./PrepUpload";

interface UploadOutput {
  json: {
    name: string;
    folderId: string;
    count: number;
    from: string;
    to: string;
  };
  binary: {
    file: {
      data: string;
      mimeType: string;
      fileName: string;
    };
  };
}

const RANGE = {
  from: "2026-05-08T18:00:00.000Z",
  to: "2026-05-09T18:00:00.000Z",
  file_date: "2026-05-10",
};

function setupSinglePage(executions: unknown[], range: typeof RANGE = RANGE) {
  vi.stubGlobal("$input", {
    all: () => [{ json: { data: executions } }],
    first: () => ({ json: { data: executions } }),
  });
  vi.stubGlobal("$", (name: string) => ({
    first: () => ({ json: name === "PrepRange" ? range : {} }),
  }));
}

function setupMultiPage(pages: unknown[][], range: typeof RANGE = RANGE) {
  vi.stubGlobal("$input", {
    all: () => pages.map((p) => ({ json: { data: p } })),
    first: () => ({ json: { data: pages[0] || [] } }),
  });
  vi.stubGlobal("$", (name: string) => ({
    first: () => ({ json: name === "PrepRange" ? range : {} }),
  }));
}

function run(): UploadOutput {
  const result = prepUpload();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as UploadOutput;
}

describe("PrepUpload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("空入力でも _meta ヘッダ 1 行は必ず出る", () => {
    setupSinglePage([]);
    const out = run();
    expect(out.json.count).toBe(0);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      _meta: { from: RANGE.from, to: RANGE.to },
    });
  });

  it("複数 execution を 1 行 1 件 + ヘッダ _meta で出力", () => {
    setupSinglePage([
      { id: "1", workflowId: "wf1", status: "success" },
      { id: "2", workflowId: "wf2", status: "error" },
    ]);
    const out = run();
    expect(out.json.count).toBe(2);
    expect(out.json.from).toBe(RANGE.from);
    expect(out.json.to).toBe(RANGE.to);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(3); // _meta + 2 行
    expect(JSON.parse(lines[0])).toEqual({
      _meta: { from: RANGE.from, to: RANGE.to },
    });
    expect(JSON.parse(lines[1]).id).toBe("1");
    expect(JSON.parse(lines[2]).id).toBe("2");
  });

  it("pagination で 複数 page 来ても全 page を集約する", () => {
    setupMultiPage([
      [{ id: "1" }, { id: "2" }],
      [{ id: "3" }, { id: "4" }],
      [{ id: "5" }],
    ]);
    const out = run();
    expect(out.json.count).toBe(5);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(6); // _meta + 5 行
    expect(JSON.parse(lines[5]).id).toBe("5");
  });

  it("ファイル名に PrepRange.file_date を使う", () => {
    setupSinglePage([{ id: "x" }]);
    const out = run();
    expect(out.json.name).toBe("2026-05-10-executions.jsonl");
    expect(out.binary.file.fileName).toBe("2026-05-10-executions.jsonl");
  });

  it("PrepRange.file_date 欠落時は JST 当日にフォールバック", () => {
    setupSinglePage([{ id: "x" }], { ...RANGE, file_date: "" });
    const out = run();
    expect(out.json.name).toMatch(/^\d{4}-\d{2}-\d{2}-executions\.jsonl$/);
  });

  it("folderId / mimeType 固定", () => {
    setupSinglePage([]);
    const out = run();
    expect(out.json.folderId).toBe("1aOOhc_tKh7ZD3Mnr4LSbj6lSGWze_0Jl");
    expect(out.binary.file.mimeType).toBe("application/jsonl");
  });
});
