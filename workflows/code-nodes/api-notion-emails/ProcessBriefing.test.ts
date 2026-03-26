import { beforeEach, describe, expect, it, vi } from "vitest";
import processBriefing from "./ProcessBriefing";

/** Notionページのモックを生成する */
function mockPage(
  id: string,
  subject: string,
  importance: string,
): IDataObject {
  return {
    id,
    properties: {
      subject: { title: [{ plain_text: subject }] },
      sender: { rich_text: [{ plain_text: "sender@test.com" }] },
      date: { date: { start: "2024-01-01" } },
      importance: { select: { name: importance } },
      snippet: { rich_text: [{ plain_text: "snippet" }] },
      reason: { rich_text: [] },
    },
    url: `https://notion.so/${id}`,
  };
}

describe("ProcessBriefing", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("重要メールと確認メールを分類する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: mockPage("p1", "銀行通知", "重要") },
        { json: mockPage("p2", "広告", "不要") },
        { json: mockPage("p3", "問い合わせ", "確認") },
      ],
    });

    const result = processBriefing() as INodeExecutionData[];
    const response = result[0].json.briefingResponse as IDataObject;
    expect((response.important as IDataObject).count).toBe(1);
    expect((response.unclassified as IDataObject).count).toBe(1);
    expect(response.marked_read_count).toBe(3);
  });

  it("結果が空の場合カウント0を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = processBriefing() as INodeExecutionData[];
    const response = result[0].json.briefingResponse as IDataObject;
    expect((response.important as IDataObject).count).toBe(0);
    expect(response.marked_read_count).toBe(0);
  });

  it("全ページIDをallPageIdsに含む", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: mockPage("p1", "mail1", "重要") },
        { json: mockPage("p2", "mail2", "不要") },
      ],
    });

    const result = processBriefing() as INodeExecutionData[];
    const ids = result[0].json.allPageIds as string[];
    expect(ids).toEqual(["p1", "p2"]);
  });
});
