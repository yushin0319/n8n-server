import { beforeEach, describe, expect, it, vi } from "vitest";
import formatError from "./FormatError";

function callAndGetItems() {
  const result = formatError();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

function mockInput(json: IDataObject) {
  vi.stubGlobal("$input", { first: () => ({ json }) });
}

describe("FormatError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常なエラーデータから obs-notify schema を返す (severity=warning, service=n8n)", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/c8ZI0oriZgjePMud/executions/123",
        lastNodeExecuted: "HTTP Request",
        error: { message: "Connection refused" },
      },
    });

    const out = callAndGetItems()[0].json;

    expect(out.severity).toBe("warning");
    expect(out.service).toBe("n8n");
    expect(out.repo).toBe("n8n-server");
    expect(out.subject).toContain("Notion Tasks");
    expect(out.subject).toContain("❌");
    expect(out.summary).toContain("HTTP Request");
    expect(out.summary).toContain("Connection refused");
    expect(out.url).toBe(
      "https://example.com/workflow/c8ZI0oriZgjePMud/executions/123",
    );
    expect(out.raw_payload).toBeDefined();
  });

  it("WF_MAP に存在する ID → WF 名に変換", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/oGx9uiLsxLGfGDcJ/executions/456",
        lastNodeExecuted: "Code",
        error: { message: "Test error" },
      },
    });
    expect(callAndGetItems()[0].json.subject).toContain("Gmail to Notion");
  });

  it("WF_MAP に無い ID → ID がそのまま使われる", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/unknownWfId123/executions/789",
        lastNodeExecuted: "Code",
        error: { message: "Test error" },
      },
    });
    expect(callAndGetItems()[0].json.subject).toContain("unknownWfId123");
  });

  it("エラー詳細が 200 文字に切り詰められる", () => {
    const longMessage = "A".repeat(300);
    mockInput({
      execution: {
        url: "https://example.com/workflow/c8ZI0oriZgjePMud/executions/1",
        lastNodeExecuted: "Code",
        error: { message: longMessage },
      },
    });
    const summary = callAndGetItems()[0].json.summary as string;
    expect(summary.length).toBeLessThanOrEqual(220);
    expect(summary).toContain("AAA");
  });

  it("execution 情報が欠落していてもエラーにならない", () => {
    mockInput({});
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("unknown");
    expect(out.summary).toContain("unknown");
  });
});
