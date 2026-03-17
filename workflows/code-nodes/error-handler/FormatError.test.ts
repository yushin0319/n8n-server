import { describe, expect, it, vi, beforeEach } from "vitest";
import formatError from "./FormatError";

/** テスト用: CodeNodeReturn を配列として扱う */
function callAndGetItems() {
  const result = formatError();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** $input.first() のモックを設定する */
function mockInput(json: IDataObject) {
  vi.stubGlobal("$input", {
    first: () => ({ json }),
  });
}

describe("FormatError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("正常なエラーデータから正しいembed構造を返す", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/c8ZI0oriZgjePMud/executions/123",
        lastNodeExecuted: "HTTP Request",
        error: { message: "Connection refused" },
      },
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveProperty("json.embed");

    const embed = items[0].json.embed as Record<string, unknown>;
    expect(embed.title).toBe("n8nエラー発生");
    expect(embed.color).toBe(15158332);
    expect(embed.fields).toHaveLength(3);
  });

  it("WF_MAPに存在するID → WF名に変換される", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/oGx9uiLsxLGfGDcJ/executions/456",
        lastNodeExecuted: "Code",
        error: { message: "Test error" },
      },
    });

    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;
    const fields = embed.fields as Array<Record<string, unknown>>;

    expect(fields[0].value).toBe("Gmail to Notion");
  });

  it("WF_MAPに存在しないID → IDがそのまま使われる", () => {
    mockInput({
      execution: {
        url: "https://example.com/workflow/unknownWfId123/executions/789",
        lastNodeExecuted: "Code",
        error: { message: "Test error" },
      },
    });

    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;
    const fields = embed.fields as Array<Record<string, unknown>>;

    expect(fields[0].value).toBe("unknownWfId123");
  });

  it("エラー詳細が200文字に切り詰められる", () => {
    const longMessage = "A".repeat(300);
    mockInput({
      execution: {
        url: "https://example.com/workflow/c8ZI0oriZgjePMud/executions/1",
        lastNodeExecuted: "Code",
        error: { message: longMessage },
      },
    });

    const items = callAndGetItems();
    const embed = items[0].json.embed as Record<string, unknown>;
    const fields = embed.fields as Array<Record<string, unknown>>;

    expect((fields[2].value as string).length).toBe(200);
  });

  it("execution情報が欠落していてもエラーにならない", () => {
    mockInput({});

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    const embed = items[0].json.embed as Record<string, unknown>;
    const fields = embed.fields as Array<Record<string, unknown>>;

    expect(fields[0].value).toBe("unknown");
    expect(fields[1].value).toBe("unknown");
    expect(fields[2].value).toBe("unknown");
  });
});
