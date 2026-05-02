import { describe, expect, it, vi } from "vitest";
import prepUpload from "./PrepUpload";

interface UploadOutput {
  json: {
    name: string;
    folderId: string;
    count: number;
    ids: string[];
  };
  binary: {
    file: {
      data: string;
      mimeType: string;
      fileName: string;
    };
  };
}

function setup(executions: unknown[]) {
  vi.stubGlobal("$input", {
    first: () => ({ json: { data: executions } }),
  });
}

function run(): UploadOutput {
  const result = prepUpload();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as UploadOutput;
}

describe("PrepUpload", () => {
  it("空入力なら count=0、binary は空文字の base64 (空文字)", () => {
    setup([]);
    const out = run();
    expect(out.json.count).toBe(0);
    expect(out.json.ids).toEqual([]);
    expect(out.binary.file.data).toBe(""); // empty JSONL → empty base64
  });

  it("複数 execution を 1 行 1 件の JSONL に整形 + ids 抽出", () => {
    setup([
      { id: "1", workflowId: "wf1", status: "success" },
      { id: "2", workflowId: "wf2", status: "error" },
    ]);
    const out = run();
    expect(out.json.count).toBe(2);
    expect(out.json.ids).toEqual(["1", "2"]);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe("1");
    expect(JSON.parse(lines[1]).id).toBe("2");
  });

  it("ファイル名に YYYY-MM-DD JST 日付を含む", () => {
    setup([{ id: "x" }]);
    const out = run();
    expect(out.json.name).toMatch(/^\d{4}-\d{2}-\d{2}-executions\.jsonl$/);
    expect(out.binary.file.fileName).toBe(out.json.name);
  });

  it("folderId は n8n-logs フォルダの固定値", () => {
    setup([]);
    const out = run();
    expect(out.json.folderId).toBe("1aOOhc_tKh7ZD3Mnr4LSbj6lSGWze_0Jl");
  });

  it("mimeType は application/jsonl", () => {
    setup([{ id: "x" }]);
    const out = run();
    expect(out.binary.file.mimeType).toBe("application/jsonl");
  });
});
