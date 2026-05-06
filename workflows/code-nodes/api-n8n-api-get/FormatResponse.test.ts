import { describe, expect, it, vi } from "vitest";
import formatResponse from "./FormatResponse";

interface Output {
  json: { status: string; data: unknown };
}

function setup(apiResponse: unknown) {
  vi.stubGlobal("$input", { first: () => ({ json: apiResponse }) });
}

function run(): Output {
  const result = formatResponse();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as Output;
}

describe("FormatResponse", () => {
  it("workflows レスポンスを data フィールドにそのまま入れる", () => {
    setup({ data: [{ id: "abc", name: "test", active: true }] });
    const out = run();
    expect(out.json.status).toBe("ok");
    expect(out.json.data).toEqual({
      data: [{ id: "abc", name: "test", active: true }],
    });
  });

  it("executions レスポンスも透過", () => {
    setup({
      data: [{ id: "1", workflowId: "w1", status: "success" }],
      nextCursor: "xyz",
    });
    const out = run();
    expect(out.json.status).toBe("ok");
    const data = out.json.data as IDataObject;
    expect(data.nextCursor).toBe("xyz");
  });

  it("空オブジェクトでも status:ok を返す", () => {
    setup({});
    const out = run();
    expect(out.json.status).toBe("ok");
    expect(out.json.data).toEqual({});
  });
});
