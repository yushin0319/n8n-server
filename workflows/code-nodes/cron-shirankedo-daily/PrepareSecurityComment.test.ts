import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareSecurityComment from "./PrepareSecurityComment";

function callAndGetItems() {
  const result = prepareSecurityComment();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareSecurityComment", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("脆弱性とリリースからGeminiプロンプトを構築する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                {
                  cve_id: "CVE-2026-1234",
                  title: "RCE脆弱性",
                  cvss_score: 9.8,
                },
              ],
            },
          }),
        };
      }
      if (nodeName === "MergeReleasePaths") {
        return {
          first: () => ({
            json: {
              releases: [
                { repo: "facebook/react", tag: "v19.0.0", type: "major" },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);

    expect(body.contents[0].parts[0].text).toContain("CVE-2026-1234");
    expect(body.contents[0].parts[0].text).toContain("facebook/react");
  });

  it("脆弱性ノードが欠損しても動作する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        throw new Error("Node not executed");
      }
      if (nodeName === "MergeReleasePaths") {
        return {
          first: () => ({
            json: {
              releases: [{ repo: "vuejs/core", tag: "v3.5.0", type: "minor" }],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items[0].json.vulnCount).toBe(0);
    expect(items[0].json.releaseCount).toBe(1);
  });

  it("リリースノードが欠損しても動作する", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                {
                  cve_id: "CVE-2026-9999",
                  title: "XSS脆弱性",
                  cvss_score: 6.1,
                },
              ],
            },
          }),
        };
      }
      if (nodeName === "MergeReleasePaths") {
        throw new Error("Node not executed");
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items[0].json.vulnCount).toBe(1);
    expect(items[0].json.releaseCount).toBe(0);
  });

  it("vulnCount と releaseCount を返す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "MergeVulnPaths") {
        return {
          first: () => ({
            json: {
              vulnerabilities: [
                { cve_id: "CVE-2026-1111", title: "脆弱性A", cvss_score: 8.0 },
                { cve_id: "CVE-2026-2222", title: "脆弱性B", cvss_score: 7.0 },
              ],
            },
          }),
        };
      }
      if (nodeName === "MergeReleasePaths") {
        return {
          first: () => ({
            json: {
              releases: [
                { repo: "nodejs/node", tag: "v22.0.0", type: "major" },
              ],
            },
          }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items[0].json.vulnCount).toBe(2);
    expect(items[0].json.releaseCount).toBe(1);
  });
});
