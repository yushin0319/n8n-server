import { beforeEach, describe, expect, it, vi } from "vitest";
import convertHealthchecks from "./ConvertHealthchecks";

function callAndGetItems() {
  const result = convertHealthchecks();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ConvertHealthchecks", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("status=down → severity=warning / subject に check name", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            name: "shirankedo-daily-articles",
            status: "down",
            tags: "n8n cron",
            url: "https://healthchecks.io/checks/abc/details/",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.service).toBe("healthchecks");
    expect(out.subject).toContain("shirankedo-daily-articles");
    expect(out.subject).toContain("DOWN");
    expect(out.url).toBe("https://healthchecks.io/checks/abc/details/");
  });

  it("status=up → severity=info", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { name: "x", status: "up" } },
      }),
    });
    expect(callAndGetItems()[0].json.severity).toBe("info");
  });

  it("name 欠如で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { status: "down" } } }),
    });
    expect(() => convertHealthchecks()).toThrow();
  });
});
