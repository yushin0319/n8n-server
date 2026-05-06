import { describe, expect, it, vi } from "vitest";
import prepUploadErrors from "./PrepUploadErrors";

interface UploadOutput {
  json: {
    name: string;
    folderId: string;
    count: number;
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
  const result = prepUploadErrors();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as UploadOutput;
}

describe("PrepUploadErrors", () => {
  it("空入力なら count=0、binary は空", () => {
    setup([]);
    const out = run();
    expect(out.json.count).toBe(0);
    expect(out.binary.file.data).toBe("");
  });

  it("失敗 execution の data フィールドを保持して JSONL に整形", () => {
    const sampleData = { resultData: { runData: { Node1: [{ error: "x" }] } } };
    setup([
      { id: "1", workflowId: "wf1", status: "error", data: sampleData },
      { id: "2", workflowId: "wf2", status: "error", data: { foo: "bar" } },
    ]);
    const out = run();
    expect(out.json.count).toBe(2);
    const decoded = Buffer.from(out.binary.file.data, "base64").toString(
      "utf-8",
    );
    const lines = decoded.split("\n");
    expect(lines).toHaveLength(2);
    const row0 = JSON.parse(lines[0]);
    expect(row0.id).toBe("1");
    expect(row0.status).toBe("error");
    expect(row0.data).toEqual(sampleData);
  });

  it("ファイル名は YYYY-MM-DD-errors.jsonl 形式", () => {
    setup([{ id: "x" }]);
    const out = run();
    expect(out.json.name).toMatch(/^\d{4}-\d{2}-\d{2}-errors\.jsonl$/);
    expect(out.binary.file.fileName).toBe(out.json.name);
  });

  it("folderId は n8n-logs フォルダの固定値 (PrepUpload と共通)", () => {
    setup([]);
    const out = run();
    expect(out.json.folderId).toBe("1aOOhc_tKh7ZD3Mnr4LSbj6lSGWze_0Jl");
  });

  it("mimeType は application/jsonl", () => {
    setup([{ id: "x", data: { foo: 1 } }]);
    const out = run();
    expect(out.binary.file.mimeType).toBe("application/jsonl");
  });

  it("ids フィールドは出力に含まない (DELETE は Phase 1 担当)", () => {
    setup([{ id: "1", status: "error" }]);
    const out = run();
    expect((out.json as IDataObject).ids).toBeUndefined();
  });
});
