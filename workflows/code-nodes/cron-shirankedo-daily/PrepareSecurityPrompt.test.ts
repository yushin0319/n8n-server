import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareSecurityPrompt from "./PrepareSecurityPrompt";

function callAndGetItems() {
  const result = prepareSecurityPrompt();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

const makeApiResponse = (overrides?: {
  vulns?: unknown[];
  releases?: unknown[];
  weeklySummaries?: unknown[];
}) => ({
  ok: true,
  data: {
    vulns: overrides?.vulns ?? [],
    releases: overrides?.releases ?? [],
    weeklySummaries: overrides?.weeklySummaries ?? [],
  },
});

describe("PrepareSecurityPrompt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("APIレスポンスからGeminiプロンプトを構築する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: makeApiResponse({
          vulns: [
            {
              cveId: "CVE-2026-1234",
              title: "RCE脆弱性",
              cvssScore: 9.8,
              publishedAt: "2026-03-20",
            },
          ],
          releases: [
            {
              repo: "facebook/react",
              tag: "v19.0.0",
              version: "v19.0.0",
              type: "major",
              publishedAt: "2026-03-20",
            },
          ],
          weeklySummaries: [
            { content: "先週のまとめ", createdAt: "2026-03-15 00:00:00" },
          ],
        }),
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);
    const prompt = body.contents[0].parts[0].text;

    expect(prompt).toContain("CVE-2026-1234");
    expect(prompt).toContain("facebook/react");
    expect(prompt).toContain("先週のまとめ");
  });

  it("vulnCount と releaseCount を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: makeApiResponse({
          vulns: [
            {
              cveId: "CVE-2026-1111",
              title: "脆弱性A",
              cvssScore: 8.0,
              publishedAt: "2026-03-20",
            },
            {
              cveId: "CVE-2026-2222",
              title: "脆弱性B",
              cvssScore: 7.0,
              publishedAt: "2026-03-20",
            },
          ],
          releases: [
            {
              repo: "nodejs/node",
              tag: "v22.0.0",
              version: "v22.0.0",
              type: "major",
              publishedAt: "2026-03-20",
            },
          ],
        }),
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.vulnCount).toBe(2);
    expect(items[0].json.releaseCount).toBe(1);
  });

  it("空データでも動作する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: makeApiResponse(),
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.vulnCount).toBe(0);
    expect(items[0].json.releaseCount).toBe(0);
    const body = JSON.parse(items[0].json.geminiBody as string);
    expect(body.contents[0].parts[0].text).toContain("なし");
  });

  it("週次サマリーが複数件ある場合プロンプトに全件含まれる", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: makeApiResponse({
          weeklySummaries: [
            { content: "サマリーA", createdAt: "2026-03-15 00:00:00" },
            { content: "サマリーB", createdAt: "2026-03-08 00:00:00" },
          ],
        }),
      }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.geminiBody as string);
    const prompt = body.contents[0].parts[0].text;

    expect(prompt).toContain("サマリーA");
    expect(prompt).toContain("サマリーB");
  });
});
