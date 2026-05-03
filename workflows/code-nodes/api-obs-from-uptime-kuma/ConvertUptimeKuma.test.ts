import { beforeEach, describe, expect, it, vi } from "vitest";
import convertKuma from "./ConvertUptimeKuma";

function callAndGetItems() {
  const r = convertKuma();
  return (Array.isArray(r) ? r : [r]) as INodeExecutionData[];
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
            heartbeat: { status: 0, msg: "timeout" },
            monitor: {
              name: "n8n HTTP",
              type: "http",
              url: "https://yushin-n8n.duckdns.org/",
            },
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
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

  it("monitor.name 欠如時: throw せず warning で unknown payload として受け流す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { heartbeat: { status: 0 } } },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Uptime Kuma unknown payload");
    expect(out.raw_payload).toEqual({ heartbeat: { status: 0 } });
  });

  it("空 body でも throw せず unknown で受け流す", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { body: {} } }) });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Uptime Kuma unknown payload");
  });
});
