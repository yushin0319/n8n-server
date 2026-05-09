import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import saveCheckpoint from "./SaveCheckpoint";

interface CheckpointOut {
  json: { last_archive_at: string };
}

function run(): CheckpointOut[] {
  const result = saveCheckpoint();
  const items = Array.isArray(result) ? result : [result];
  return items as CheckpointOut[];
}

describe("SaveCheckpoint", () => {
  let staticData: Record<string, unknown>;

  beforeEach(() => {
    staticData = {};
    vi.stubGlobal("$getWorkflowStaticData", (_scope: string) => staticData);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PrepRange.to を staticData.last_archive_at に保存する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json:
          name === "PrepRange"
            ? {
                from: "2026-05-08T18:00:00.000Z",
                to: "2026-05-09T18:00:00.000Z",
              }
            : {},
      }),
    }));
    const out = run();
    expect(staticData.last_archive_at).toBe("2026-05-09T18:00:00.000Z");
    expect(out[0].json.last_archive_at).toBe("2026-05-09T18:00:00.000Z");
  });

  it("to が空文字なら staticData は更新しない", () => {
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { to: "" } }),
    }));
    const out = run();
    expect(staticData.last_archive_at).toBeUndefined();
    expect(out[0].json.last_archive_at).toBe("");
  });
});
