import { describe, expect, it, vi, beforeEach } from "vitest";
import parseNVD from "./ParseNVD";

function callAndGetItems() {
  const result = parseNVD();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** テスト用NVDレスポンスヘルパー */
function makeNvdEntry(
  id: string,
  baseScore: number,
  description = "Test vulnerability",
  metricVersion: "v31" | "v30" = "v31",
) {
  const metricKey =
    metricVersion === "v31" ? "cvssMetricV31" : "cvssMetricV30";
  return {
    cve: {
      id,
      descriptions: [{ lang: "en", value: description }],
      metrics: {
        [metricKey]: [{ cvssData: { baseScore } }],
      },
      published: "2026-03-17T10:00:00.000",
    },
  };
}

describe("ParseNVD", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("CVSS >= 8.0 の脆弱性のみ抽出する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                makeNvdEntry("CVE-2026-0001", 9.8),
                makeNvdEntry("CVE-2026-0002", 7.5), // 除外される
                makeNvdEntry("CVE-2026-0003", 8.0),
              ],
            },
          }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const data = items[0].json;

    expect(data.count).toBe(2);
    const vulns = data.vulnerabilities as IDataObject[];
    expect(vulns[0].cveId).toBe("CVE-2026-0001");
    expect(vulns[0].cvssScore).toBe(9.8);
    expect(vulns[1].cveId).toBe("CVE-2026-0003");
  });

  it("既存CVE IDは除外する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                makeNvdEntry("CVE-2026-0001", 9.8),
                makeNvdEntry("CVE-2026-0002", 9.0),
              ],
            },
          }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: ["CVE-2026-0001"] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(1);
    expect(
      (items[0].json.vulnerabilities as IDataObject[])[0].cveId,
    ).toBe("CVE-2026-0002");
  });

  it("CVSS V3.0 メトリクスもサポートする", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [makeNvdEntry("CVE-2026-0001", 8.5, "test", "v30")],
            },
          }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(1);
  });

  it("CVSSスコアがない脆弱性は除外する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                {
                  cve: {
                    id: "CVE-2026-0001",
                    descriptions: [{ lang: "en", value: "no score" }],
                    metrics: {},
                    published: "2026-03-17T10:00:00.000",
                  },
                },
              ],
            },
          }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(0);
  });

  it("descriptionは500文字に切り詰める", () => {
    const longDesc = "A".repeat(600);
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [makeNvdEntry("CVE-2026-0001", 9.0, longDesc)],
            },
          }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const vulns = items[0].json.vulnerabilities as IDataObject[];
    expect((vulns[0].description as string).length).toBe(500);
  });

  it("脆弱性が0件の場合", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FetchNVD") {
        return {
          first: () => ({ json: { vulnerabilities: [] } }),
        };
      }
      if (nodeName === "FetchExistingCVEs") {
        return { first: () => ({ json: { data: [] } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    expect(items[0].json.count).toBe(0);
    expect(items[0].json.vulnerabilities).toEqual([]);
  });
});
