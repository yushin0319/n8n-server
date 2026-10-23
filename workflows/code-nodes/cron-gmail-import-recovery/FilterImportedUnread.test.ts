import { beforeEach, describe, expect, it, vi } from "vitest";
import filterImportedUnread from "./FilterImportedUnread";

function makeGmail(id: string, labelIds: string[]) {
  return {
    json: {
      id,
      subject: `subj-${id}`,
      labels: labelIds.map((l) => ({ id: l, name: l })),
    },
  };
}

function makeNotionItem(messageId: string) {
  return {
    json: {
      properties: {
        messageId: { rich_text: [{ plain_text: messageId }] },
      },
    },
  };
}

function stub(gmailItems: unknown[], notionItems: unknown[]) {
  vi.stubGlobal("$", (name: string) => {
    if (name === "GmailGetMany") return { all: () => gmailItems };
    throw new Error(`unexpected $(${name})`);
  });
  vi.stubGlobal("$input", { all: () => notionItems });
}

describe("FilterImportedUnread", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Notion に登録済みで Gmail 上は未読のメールだけ返す", () => {
    stub(
      [
        makeGmail("m1", ["UNREAD", "INBOX"]),
        makeGmail("m2", ["INBOX"]),
        makeGmail("m3", ["UNREAD", "INBOX"]),
      ],
      [makeNotionItem("m1"), makeNotionItem("m2")],
    );

    const result = filterImportedUnread() as INodeExecutionData[];
    expect(result.map((r) => r.json.id)).toEqual(["m1"]);
  });

  it("未登録のメールは未読でも返さない（取り込みは FilterUnimported 側が担当）", () => {
    stub([makeGmail("m1", ["UNREAD"])], [makeNotionItem("other")]);

    const result = filterImportedUnread() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });

  it("labels が無いアイテムは既読扱いでスキップ", () => {
    stub([{ json: { id: "m1" } }], [makeNotionItem("m1")]);

    const result = filterImportedUnread() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });

  it("Notion 側に alwaysOutputData の空アイテムしか無ければ空を返す", () => {
    stub([makeGmail("m1", ["UNREAD"])], [{ json: {} }]);

    const result = filterImportedUnread() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });
});
