import { describe, expect, it, vi } from "vitest";
import checkTestMode from "./CheckTestMode";

describe("CheckTestMode (cron-db-archive-execution)", () => {
  it("_shared/checkTestMode を呼んで isTest フラグをセットする", () => {
    const customData = new Map<string, string>();
    const mockExecution = {
      customData: {
        set: (k: string, v: string) => customData.set(k, v),
        get: (k: string) => customData.get(k),
      },
    };
    vi.stubGlobal("$input", {
      all: () => [{ json: { headers: {}, body: { test: true } } }],
    });
    vi.stubGlobal("$execution", mockExecution);

    const result = checkTestMode();

    expect(customData.get("isTest")).toBe("true");
    expect(Array.isArray(result)).toBe(true);
  });
});
