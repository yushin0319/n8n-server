import { describe, expect, it, vi } from "vitest";
import prepRequest from "./PrepRequest";

interface Output {
  json: { url: string; endpoint: string };
}

function setup(body: unknown) {
  vi.stubGlobal("$input", { first: () => ({ json: body }) });
}

function run(): Output {
  const result = prepRequest();
  const items = Array.isArray(result) ? result : [result];
  return items[0] as Output;
}

describe("PrepRequest", () => {
  it("action を base URL の後ろに連結する", () => {
    setup({ action: "workflows?limit=200" });
    const out = run();
    expect(out.json.url).toBe(
      "http://localhost:5678/api/v1/workflows?limit=200",
    );
    expect(out.json.endpoint).toBe("workflows?limit=200");
  });

  it("先頭スラッシュは除去される", () => {
    setup({ action: "/executions/abc" });
    const out = run();
    expect(out.json.url).toBe("http://localhost:5678/api/v1/executions/abc");
    expect(out.json.endpoint).toBe("executions/abc");
  });

  it("body フィールドにネストされた action も読める (Webhook の body 構造を吸収)", () => {
    setup({ body: { action: "users" } });
    const out = run();
    expect(out.json.url).toBe("http://localhost:5678/api/v1/users");
  });

  it("クエリパラメータ複数も透過", () => {
    setup({ action: "executions?status=error&limit=50&includeData=true" });
    const out = run();
    expect(out.json.endpoint).toBe(
      "executions?status=error&limit=50&includeData=true",
    );
  });

  it("action が空なら例外", () => {
    setup({ action: "" });
    expect(() => run()).toThrow("'action' は必須");
  });

  it("action 未指定でも例外", () => {
    setup({});
    expect(() => run()).toThrow("'action' は必須");
  });

  it("action が空白だけなら trim して例外", () => {
    setup({ action: "   " });
    expect(() => run()).toThrow("'action' は必須");
  });
});
