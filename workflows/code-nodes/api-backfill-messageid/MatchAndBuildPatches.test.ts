import { beforeEach, describe, expect, it, vi } from "vitest";
import matchAndBuildPatches from "./MatchAndBuildPatches";

function makeGmail(id: string, subject: string, dateMs: number) {
  return {
    json: {
      id,
      Subject: subject,
      internalDate: String(dateMs),
    },
  };
}

function makeNotion(
  pageId: string,
  subject: string,
  dateISO: string,
  messageId?: string,
) {
  const msgProp = messageId
    ? { messageId: { rich_text: [{ plain_text: messageId }] } }
    : {};
  return {
    json: {
      id: pageId,
      properties: {
        subject: { title: [{ plain_text: subject }] },
        date: { date: { start: dateISO } },
        ...msgProp,
      },
    },
  };
}

function stubWebhookTest(isTest: boolean) {
  return {
    first: () => ({ json: { body: { test: isTest } } }),
  };
}

describe("MatchAndBuildPatches", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("非テスト + マッチあり → マッチ数分のアイテムを返す", () => {
    const baseMs = Date.parse("2026-04-22T12:00:00Z");
    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany")
        return { all: () => [makeGmail("gmail-1", "invoice", baseMs)] };
      if (name === "Webhook") return stubWebhookTest(false);
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      all: () => [makeNotion("page-1", "invoice", "2026-04-22T12:00:30.000Z")],
    });

    const result = matchAndBuildPatches() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toMatchObject({
      pageId: "page-1",
      messageId: "gmail-1",
      subject: "invoice",
    });
  });

  it("Notion に既に messageId がある場合はスキップ", () => {
    const baseMs = Date.parse("2026-04-22T12:00:00Z");
    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany")
        return { all: () => [makeGmail("gmail-1", "x", baseMs)] };
      if (name === "Webhook") return stubWebhookTest(false);
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      all: () => [
        makeNotion("page-1", "x", "2026-04-22T12:00:00Z", "existing"),
      ],
    });

    const result = matchAndBuildPatches() as INodeExecutionData[];
    expect(result[0].json.type).toBe("summary");
    expect(result[0].json.matched).toBe(0);
    expect(result[0].json.skippedAlreadySet).toBe(1);
  });

  it("日付が 5 分を超えて乖離 → マッチ不成立", () => {
    const baseMs = Date.parse("2026-04-22T12:00:00Z");
    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany")
        return { all: () => [makeGmail("gmail-1", "same", baseMs)] };
      if (name === "Webhook") return stubWebhookTest(false);
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      all: () => [makeNotion("page-1", "same", "2026-04-22T12:10:00Z")],
    });

    const result = matchAndBuildPatches() as INodeExecutionData[];
    expect(result[0].json.type).toBe("summary");
    expect(result[0].json.matched).toBe(0);
    expect(result[0].json.skippedNoMatch).toBe(1);
  });

  it("test:true なら必ずサマリー 1 件 (matches は samples に埋め込み)", () => {
    const baseMs = Date.parse("2026-04-22T12:00:00Z");
    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany")
        return { all: () => [makeGmail("gmail-1", "x", baseMs)] };
      if (name === "Webhook") return stubWebhookTest(true);
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      all: () => [makeNotion("page-1", "x", "2026-04-22T12:00:00Z")],
    });

    const result = matchAndBuildPatches() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.type).toBe("summary");
    expect(result[0].json.test).toBe(true);
    expect(result[0].json.matched).toBe(1);
    expect(
      (result[0].json.samples as Array<{ pageId: string }>)[0].pageId,
    ).toBe("page-1");
  });

  it("Notion 空 → 0 件サマリーを返す", () => {
    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => [] };
      if (name === "Webhook") return stubWebhookTest(false);
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", { all: () => [] });

    const result = matchAndBuildPatches() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.matched).toBe(0);
    expect(result[0].json.gmailCount).toBe(0);
    expect(result[0].json.notionCount).toBe(0);
  });
});
