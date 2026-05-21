import { beforeEach, describe, expect, it, vi } from "vitest";
import convertNetdata from "./ConvertNetdata";

function callAndGetItems() {
  const r = convertNetdata();
  return (Array.isArray(r) ? r : [r]) as INodeExecutionData[];
}

describe("ConvertNetdata", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("CRITICAL status → severity=critical / subject に emoji", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            alarm: "system_post_update_reboot_status",
            alarm_status: "CRITICAL",
            host: "instance-20260206-1437",
            info: "System requires reboot after package updates",
            value_string: "1 status",
            chart: "system.post_update_reboot_status",
            class: "Errors",
            url: "https://app.netdata.cloud/spaces/yushin-infra",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("critical");
    expect(out.service).toBe("netdata");
    expect(out.subject).toContain("🚨");
    expect(out.subject).toContain("system_post_update_reboot_status");
    expect(out.url).toBe("https://app.netdata.cloud/spaces/yushin-infra");
    expect(out.repo).toBe("n8n-server");
  });

  it("WARNING status → severity=warning", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            alarm: "10min_received_packets_dropped",
            alarm_status: "WARNING",
            host: "n8n-server",
            info: "packets dropped",
            value_string: "100 packets",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("⚠");
  });

  it("CLEAR status → severity=info", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            alarm: "web_log_1m_successful",
            alarm_status: "CLEAR",
            host: "n8n-server",
            value_string: "98%",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("info");
    expect(out.subject).toContain("✅");
  });

  it("javascript:// 等の non-http URL は弾く", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            alarm: "x",
            alarm_status: "WARNING",
            host: "n8n-server",
            url: "javascript:alert(1)",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.url).toBeUndefined();
  });

  it("alarm 名抽出不可 → severity=warning + raw_payload 保持", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { foo: "bar" } } }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Netdata unknown payload");
    expect(out.raw_payload).toEqual({ foo: "bar" });
  });

  it("空 body でも throw せず warning で受け流す", () => {
    vi.stubGlobal("$input", { first: () => ({ json: { body: {} } }) });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("Netdata unknown payload");
  });

  it("alert_name / status / host_name の別名フィールドも拾う", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            alert_name: "20min_steal_cpu",
            status: "warning",
            host_name: "crypto-ai-trader",
            alert_value_string: "12%",
          },
        },
      }),
    });
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.subject).toContain("20min_steal_cpu");
    expect(out.repo).toBe("crypto-ai-trader");
  });
});
