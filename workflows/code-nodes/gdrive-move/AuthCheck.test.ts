import { describe, expect, it, vi, beforeEach } from "vitest";
import authCheckFn from "./AuthCheck";

describe("gdrive-move/AuthCheck", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("認証成功時にアイテムをそのまま返す", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: { "x-webhook-secret": "test-secret" }, body: {} } },
    ];
    vi.stubGlobal("$input", { all: () => items });
    vi.stubGlobal("$env", { WEBHOOK_SECRET: "test-secret" });

    const result = authCheckFn();
    expect(result).toEqual(items);
  });
});
