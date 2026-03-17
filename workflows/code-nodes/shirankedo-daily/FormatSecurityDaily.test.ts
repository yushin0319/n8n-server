import { describe, expect, it, vi, beforeEach } from "vitest";
import formatSecurityDaily from "./FormatSecurityDaily";

function callAndGetItems() {
  const result = formatSecurityDaily();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

/** Geminiレスポンスのヘルパー */
function geminiResponse(data: unknown) {
  return {
    candidates: [
      { content: { parts: [{ text: JSON.stringify(data) }] } },
    ],
  };
}

describe("FormatSecurityDaily", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Geminiレスポンスからコメントを抽出する", () => {
    const securityComment = {
      comment: "今日はマジで平和っしょ",
      vuln_ids: ["CVE-2026-1234"],
      release_ids: [],
    };
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(securityComment) }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body.comment).toBe("今日はマジで平和っしょ");
    expect(items[0].json.comment).toBe("今日はマジで平和っしょ");
  });

  it("vuln_ids と release_ids を含む", () => {
    const securityComment = {
      comment: "やばいのきた",
      vuln_ids: ["CVE-2026-1111", "CVE-2026-2222"],
      release_ids: [],
    };
    vi.stubGlobal("$input", {
      first: () => ({ json: geminiResponse(securityComment) }),
    });

    const items = callAndGetItems();
    const body = JSON.parse(items[0].json.requestBody as string);

    expect(body.vuln_ids).toEqual(["CVE-2026-1111", "CVE-2026-2222"]);
    expect(body.release_ids).toEqual([]);
  });
});
