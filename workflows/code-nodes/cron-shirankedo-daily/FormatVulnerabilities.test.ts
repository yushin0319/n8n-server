import { beforeEach, describe, expect, it, vi } from "vitest";
import formatVulnerabilities from "./FormatVulnerabilities";

function callAndGetItems() {
  const result = formatVulnerabilities();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** Geminiレスポンスのヘルパー */
function geminiResponse(data: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
  };
}

describe("FormatVulnerabilities", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("翻訳タイトルとCVEデータをマージする", () => {
    const titles = [{ index: 1, title: "リモートコード実行の脆弱性" }];
    const vulns = [
      {
        cveId: "CVE-2026-1234",
        description: "Remote code execution vulnerability in XYZ",
        cvssScore: 9.8,
        publishedAt: "2026-03-17",
      },
    ];

    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(titles) }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareNVDTranslation") {
        return {
          first: () => ({ json: { vulnerabilities: vulns } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body).toHaveLength(1);
    expect(body[0].cveId).toBe("CVE-2026-1234");
    expect(body[0].title).toBe("リモートコード実行の脆弱性");
    expect(items[0].json.count).toBe(1);
  });

  it("Geminiパース失敗時はdescriptionの先頭50文字にフォールバックする", () => {
    const vulns = [
      {
        cveId: "CVE-2026-5678",
        description:
          "A very long description of a vulnerability that exceeds fifty characters limit",
        cvssScore: 7.5,
        publishedAt: "2026-03-17",
      },
    ];

    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [{ content: { parts: [{ text: "invalid json" }] } }],
        },
      }),
    });
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "PrepareNVDTranslation") {
        return {
          first: () => ({ json: { vulnerabilities: vulns } }),
        };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body[0].title).toBe(vulns[0].description.substring(0, 50));
  });
});
