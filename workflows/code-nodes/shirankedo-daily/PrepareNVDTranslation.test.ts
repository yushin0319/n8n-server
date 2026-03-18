import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareNVDTranslation from "./PrepareNVDTranslation";

function callAndGetItems() {
  const result = prepareNVDTranslation();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepareNVDTranslation", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("脆弱性データからGemini翻訳プロンプトを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          vulnerabilities: [
            {
              cveId: "CVE-2026-1234",
              description: "Remote code execution in XYZ component",
              cvssScore: 9.8,
              publishedAt: "2026-03-17",
            },
          ],
        },
      }),
    });

    const items = callAndGetItems();

    expect(items[0].json.count).toBe(1);
    expect(items[0].json.skip).toBe(false);
    const body = JSON.parse(items[0].json.geminiBody as string);
    expect(body.contents[0].parts[0].text).toContain("CVE-2026-1234");
  });

  it("脆弱性が空の場合は skip=true を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { vulnerabilities: [] },
      }),
    });

    const items = callAndGetItems();

    expect(items[0].json.skip).toBe(true);
    expect(items[0].json.count).toBe(0);
  });

  it("geminiBody が有効なJSONである", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          vulnerabilities: [
            {
              cveId: "CVE-2026-5678",
              description: "SQL injection vulnerability",
              cvssScore: 7.5,
              publishedAt: "2026-03-17",
            },
          ],
        },
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);

    expect(body).toHaveProperty("contents");
    expect(body).toHaveProperty("generationConfig");
  });
});
