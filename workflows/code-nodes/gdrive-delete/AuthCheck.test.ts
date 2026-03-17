import { describe, expect, it, vi, beforeEach } from "vitest";
import authCheck from "./AuthCheck";

describe("gdrive-delete/AuthCheck", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正しいsecretならアイテムをそのまま返す", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: { "x-webhook-secret": "test-secret" }, body: {} } },
    ];
    vi.stubGlobal("$input", { all: () => items });
    vi.stubGlobal("$env", { WEBHOOK_SECRET: "test-secret" });

    const result = authCheck();
    expect(result).toEqual(items);
  });

  it("不正なsecretならエラーを投げる", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: { "x-webhook-secret": "wrong" }, body: {} } },
    ];
    vi.stubGlobal("$input", { all: () => items });
    vi.stubGlobal("$env", { WEBHOOK_SECRET: "test-secret" });

    expect(() => authCheck()).toThrow("Forbidden");
  });
});
