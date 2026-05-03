import { beforeEach, describe, expect, it, vi } from "vitest";
import convertKuma from "./ConvertUptimeKuma";

function callAndGetItems() {
  const result = convertKuma();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("ConvertUptimeKuma", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("status=0 (DOWN) → severity=warning / monitor name を subject に", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            heartbeat: {
              status: 0,
              msg: "timeout",
              time: "2026-05-03T...",
            },
            monitor: {
              name: "n8n HTTP",
              type: "http",
              url: "https://yushin-n8n.duckdns.org/",
            },
            msg: "fail",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.service).toBe("uptime-kuma");
    expect(out.subject).toContain("n8n HTTP");
    expect(out.subject).toContain("DOWN");
    expect(out.url).toBe("https://yushin-n8n.duckdns.org/");
  });

  it("status=1 (UP) → severity=info", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            heartbeat: { status: 1, msg: "200 - OK" },
            monitor: { name: "n8n HTTP" },
          },
        },
      }),
    });
    expect(callAndGetItems()[0].json.severity).toBe("info");
  });

  it("monitor.name 欠如で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { heartbeat: { status: 0 } } },
      }),
    });
    expect(() => convertKuma()).toThrow();
  });
});
