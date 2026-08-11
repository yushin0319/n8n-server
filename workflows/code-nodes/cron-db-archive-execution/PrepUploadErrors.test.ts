import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prepUploadErrors from "./PrepUploadErrors";

interface UploadOutput {
  json: {
    name: string;
    folderId: string;
    count: number;
    dropped: number;
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
  const result = prepUploadErrors();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as UploadOutput;
}

describe("PrepUploadErrors", () => {
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
      _meta: {
        from: RANGE.from,
        to: RANGE.to,
        truncated: false,
        dropped: 0,
        max_rows: 200,
      },
    });
  });

  it("失敗 execution の data フィールドを保持 + ヘッダ _meta", () => {
    const sampleData = { resultData: { runData: { Node1: [{ error: "x" }] } } };
    setupSinglePage([
      {
        id: "1",
        workflowId: "wf1",
        status: "error",
        startedAt: "2026-05-09T00:00:00.000Z",
        data: sampleData,
      },
      {
        id: "2",
        workflowId: "wf2",
        status: "error",
        startedAt: "2026-05-09T12:00:00.000Z",
        data: { foo: "bar" },
      },
    ]);
    const out = run();
    expect(out.json.count).toBe(2);
    expect(out.json.from).toBe(RANGE.from);
    expect(out.json.to).toBe(RANGE.to);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual({
      _meta: {
        from: RANGE.from,
        to: RANGE.to,
        truncated: false,
        dropped: 0,
        max_rows: 200,
      },
    });
    const row1 = JSON.parse(lines[1]);
    expect(row1.id).toBe("1");
    expect(row1.data).toEqual(sampleData);
  });

  it("MAX_ERROR_ROWS (200) を超えたら打ち切り、_meta に truncated/dropped を残す", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: String(i),
      status: "error",
      startedAt: "2026-05-09T00:00:00.000Z",
    }));
    setupSinglePage(many);
    const out = run();
    expect(out.json.count).toBe(200);
    expect(out.json.dropped).toBe(50);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(201); // _meta + 200
    expect(JSON.parse(lines[0])._meta).toEqual({
      from: RANGE.from,
      to: RANGE.to,
      truncated: true,
      dropped: 50,
      max_rows: 200,
    });
    // 先頭 (API 返却順 = 新しい順) から採用されている
    expect(JSON.parse(lines[1]).id).toBe("0");
  });

  it("pagination で複数 page 来ても全 page 集約", () => {
    setupMultiPage([
      [
        {
          id: "1",
          status: "error",
          startedAt: "2026-05-09T00:00:00.000Z",
        },
      ],
      [
        {
          id: "2",
          status: "error",
          startedAt: "2026-05-09T01:00:00.000Z",
        },
      ],
    ]);
    const out = run();
    expect(out.json.count).toBe(2);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(3); // _meta + 2
  });

  it("startedAt < from の error execution は除外される (range filter)", () => {
    setupSinglePage([
      // RANGE.from = 2026-05-08T18:00:00Z
      {
        id: "old",
        status: "error",
        startedAt: "2026-05-08T17:59:59.000Z",
      },
      {
        id: "in",
        status: "error",
        startedAt: "2026-05-09T00:00:00.000Z",
      },
    ]);
    const out = run();
    expect(out.json.count).toBe(1);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const ids = decoded
      .split("\n")
      .slice(1)
      .map((l) => JSON.parse(l).id);
    expect(ids).toEqual(["in"]);
  });

  it("ファイル名は YYYY-MM-DD-errors.jsonl 形式", () => {
    setupSinglePage([{ id: "x", startedAt: "2026-05-09T00:00:00.000Z" }]);
    const out = run();
    expect(out.json.name).toBe("2026-05-10-errors.jsonl");
    expect(out.binary.file.fileName).toBe("2026-05-10-errors.jsonl");
  });

  it("folderId / mimeType 固定", () => {
    setupSinglePage([]);
    const out = run();
    expect(out.json.folderId).toBe("1aOOhc_tKh7ZD3Mnr4LSbj6lSGWze_0Jl");
    expect(out.binary.file.mimeType).toBe("application/jsonl");
  });

  it("ids フィールドは含めない (DELETE 廃止 / Notion #561)", () => {
    setupSinglePage([
      {
        id: "1",
        status: "error",
        startedAt: "2026-05-09T00:00:00.000Z",
      },
    ]);
    const out = run();
    expect((out.json as unknown as IDataObject).ids).toBeUndefined();
  });
});
