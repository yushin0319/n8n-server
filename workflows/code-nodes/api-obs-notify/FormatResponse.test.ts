import { beforeEach, describe, expect, it, vi } from "vitest";
import formatResponse from "./FormatResponse";

function callAndGetItems() {
  const result = formatResponse();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

const prepStub = {
  severity: "info",
  service: "n8n",
  channel: "obs-info",
};

function stubNodes(discordJson: unknown, notionJson: unknown) {
  vi.stubGlobal("$", (n: string) => {
    if (n === "PrepNotify") return { first: () => ({ json: prepStub }) };
    if (n === "SendDiscord") return { first: () => ({ json: discordJson }) };
    throw new Error(`unknown: ${n}`);
  });
  vi.stubGlobal("$input", { first: () => ({ json: notionJson }) });
}

describe("FormatResponse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("両方成功: success=true / Discord と Notion の status を返す", () => {
    stubNodes({ statusCode: 204 }, { object: "page", id: "page-123" });
    const items = callAndGetItems();
    expect(items[0].json.success).toBe(true);
    expect(items[0].json.discord).toEqual({ ok: true, status: 204 });
    expect(items[0].json.notion).toEqual({
      ok: true,
      page_id: "page-123",
      error_code: null,
    });
  });

  it("Discord 200 OK / Notion 失敗 → success=false", () => {
    stubNodes(
      { statusCode: 200 },
      { object: "error", code: "validation_error" },
    );
    const items = callAndGetItems();
    expect(items[0].json.success).toBe(false);
    expect(items[0].json.notion).toEqual({
      ok: false,
      page_id: null,
      error_code: "validation_error",
    });
  });

  it("Discord 4xx / Notion 成功 → success=false (4xx は ok=false)", () => {
    stubNodes({ statusCode: 429 }, { object: "page", id: "p" });
    const items = callAndGetItems();
    expect(items[0].json.success).toBe(false);
    expect(items[0].json.discord).toEqual({ ok: false, status: 429 });
  });

  it("Discord 5xx / Notion 成功 → success=false", () => {
    stubNodes({ statusCode: 500 }, { object: "page", id: "p" });
    const items = callAndGetItems();
    expect(items[0].json.success).toBe(false);
    expect(items[0].json.discord).toEqual({ ok: false, status: 500 });
  });

  it("Discord ネットワーク error (statusCode なし) → success=false", () => {
    stubNodes({ error: "timeout" }, { object: "page", id: "p" });
    const items = callAndGetItems();
    expect(items[0].json.success).toBe(false);
    expect(items[0].json.discord).toEqual({ ok: false, status: null });
  });

  it("両方失敗 → success=false", () => {
    stubNodes({ error: "timeout" }, { object: "error", code: "rate_limited" });
    expect(callAndGetItems()[0].json.success).toBe(false);
  });
});
