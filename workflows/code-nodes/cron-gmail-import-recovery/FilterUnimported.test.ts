import { beforeEach, describe, expect, it, vi } from "vitest";
import filterUnimported from "./FilterUnimported";

function makeGmail(id: string, extra: Record<string, unknown> = {}) {
  return {
    json: {
      id,
      subject: `subj-${id}`,
      from: "a@b.com",
      snippet: "",
      internalDate: "0",
      ...extra,
    },
  };
}

function makeNotionPage(messageId: string) {
  return {
    json: {
      properties: {
        messageId: { rich_text: [{ plain_text: messageId }] },
      },
    },
  };
}

describe("FilterUnimported", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Notion に全件登録済みなら空を返す", () => {
    const gmailItems = [makeGmail("m1"), makeGmail("m2")];
    const notionResults = [
      makeNotionPage("m1").json,
      makeNotionPage("m2").json,
    ];

    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => gmailItems };
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: notionResults } }),
    });

    const result = filterUnimported() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });

  it("一部未登録があれば未登録分のみ返す", () => {
    const gmailItems = [makeGmail("m1"), makeGmail("m2"), makeGmail("m3")];
    const notionResults = [makeNotionPage("m1").json];

    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => gmailItems };
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: notionResults } }),
    });

    const result = filterUnimported() as INodeExecutionData[];
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.json.id);
    expect(ids).toEqual(["m2", "m3"]);
  });

  it("Notion 側 results が空なら Gmail 全件を返す", () => {
    const gmailItems = [makeGmail("m1"), makeGmail("m2")];

    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => gmailItems };
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", { first: () => ({ json: { results: [] } }) });

    const result = filterUnimported() as INodeExecutionData[];
    expect(result).toHaveLength(2);
  });

  it("Notion ページの messageId が空文字/未設定なら照合対象から除外する", () => {
    const gmailItems = [makeGmail("m1")];
    const notionResults = [{ properties: { messageId: { rich_text: [] } } }];

    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => gmailItems };
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", {
      first: () => ({ json: { results: notionResults } }),
    });

    const result = filterUnimported() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.id).toBe("m1");
  });

  it("Gmail 側で id が欠落しているアイテムはスキップ", () => {
    const gmailItems = [{ json: { subject: "no id" } }, makeGmail("m2")];

    vi.stubGlobal("$", (name: string) => {
      if (name === "GmailGetMany") return { all: () => gmailItems };
      throw new Error(`unexpected $(${name})`);
    });
    vi.stubGlobal("$input", { first: () => ({ json: { results: [] } }) });

    const result = filterUnimported() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.id).toBe("m2");
  });
});
