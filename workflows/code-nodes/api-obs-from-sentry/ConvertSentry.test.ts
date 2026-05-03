import { beforeEach, describe, expect, it, vi } from "vitest";
import convertSentry from "./ConvertSentry";

function callAndGetItems() {
  const result = convertSentry();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ConvertSentry", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Sentry issue alert (level=error) → severity=warning / service=sentry / project から repo 推定", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            action: "triggered",
            data: {
              issue: {
                id: "12345",
                title: "Connection refused",
                level: "error",
                permalink: "https://sentry.io/...",
                project: { slug: "shirankedo" },
              },
            },
          },
        },
      }),
    });

    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.service).toBe("sentry");
    expect(out.subject).toContain("Connection refused");
    expect(out.url).toBe("https://sentry.io/...");
    expect(out.repo).toBe("shirankedo");
  });

  it("level=fatal → severity=critical", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            data: {
              issue: {
                title: "OOM",
                level: "fatal",
                permalink: "https://sentry.io/x",
                project: { slug: "n8n-server" },
              },
            },
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("critical");
    expect(out.repo).toBe("n8n-server");
  });

  it("level=warning → severity=warning / level=info → severity=info", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { data: { issue: { title: "x", level: "warning" } } },
        },
      }),
    });
    expect(callAndGetItems()[0].json.severity).toBe("warning");

    vi.unstubAllGlobals();
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { data: { issue: { title: "x", level: "info" } } },
        },
      }),
    });
    expect(callAndGetItems()[0].json.severity).toBe("info");
  });

  it("event 形式 (issue ではなく event を含む) も対応", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            data: {
              event: {
                title: "TypeError",
                level: "error",
                web_url: "https://sentry.io/event/1",
                project_slug: "worldpulse-api",
              },
            },
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("TypeError");
    expect(out.url).toBe("https://sentry.io/event/1");
    expect(out.repo).toBe("WorldPulse");
  });

  it("不明な project slug は repo を含めない", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            data: {
              issue: {
                title: "x",
                level: "error",
                project: { slug: "unknown-project" },
              },
            },
          },
        },
      }),
    });
    expect(callAndGetItems()[0].json.repo).toBeUndefined();
  });

  it("空 body で throw", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { body: {} } }) });
    expect(() => convertSentry()).toThrow();
  });
});
