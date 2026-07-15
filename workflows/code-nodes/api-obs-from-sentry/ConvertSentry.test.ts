import { beforeEach, describe, expect, it, vi } from "vitest";
import convertSentry from "./ConvertSentry";

function callAndGetItems() {
  const r = convertSentry();
  return (Array.isArray(r) ? r : [r]) as INodeExecutionData[];
}

describe("ConvertSentry", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("issue.title 経路: severity=warning / repo は project slug から推定", () => {
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
    expect(callAndGetItems()[0].json.severity).toBe("critical");
  });

  it("event 形式 (data.event) も対応", () => {
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
    expect(out.subject).toContain("TypeError");
    expect(out.repo).toBe("WorldPulse");
  });

  it("error.metadata.value fallback", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            action: "created",
            data: {
              error: {
                event_id: "abc",
                metadata: {
                  value: "ConnectionError: timeout",
                  type: "ConnectionError",
                },
                level: "error",
              },
            },
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.subject).toContain("ConnectionError: timeout");
    expect(out.severity).toBe("warning");
  });

  it("title 取得不可: severity=warning / unknown payload subject + raw_payload 保持", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { action: "triggered", data: { unknown: "x" } },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Sentry unknown event payload");
    expect(out.subject).toContain("action=triggered");
    expect(out.raw_payload).toEqual({
      action: "triggered",
      data: { unknown: "x" },
    });
  });

  it("空 body でも throw せず warning で受け流す", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { body: {} } }) });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Sentry unknown event payload");
  });

  it("EventLoopBlocked は level=error でも severity=info に格下げ (慢性ノイズ抑制 #614/#477)", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            data: {
              issue: {
                title: "EventLoopBlocked: Event Loop Blocked for at least 2000 ms",
                level: "error",
                permalink: "https://sentry.io/elb",
                project: { slug: "n8n-server" },
              },
            },
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("EventLoopBlocked");
    expect(out.repo).toBe("n8n-server");
  });
});
