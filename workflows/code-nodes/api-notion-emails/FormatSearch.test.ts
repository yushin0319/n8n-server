import { beforeEach, describe, expect, it, vi } from "vitest";
import formatSearch from "./FormatSearch";

describe("FormatSearch (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const makePage = (overrides: IDataObject = {}): IDataObject => ({
    id: "page-1",
    url: "https://notion.so/page-1",
    properties: {
      件名: { title: [{ plain_text: "テストメール" }] },
      差出人: { rich_text: [{ plain_text: "sender@example.com" }] },
      日時: { date: { start: "2026-03-17T10:00:00" } },
      重要度: { select: { name: "重要" } },
      スニペット: { rich_text: [{ plain_text: "本文の一部" }] },
      ステータス: { select: { name: "未読" } },
      理由: { rich_text: [{ plain_text: "重要な案件" }] },
      ...overrides,
    },
  });

  it("Notionページからメールプロパティを正しく抽出する", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: makePage() }],
    });

    const result = formatSearch() as INodeExecutionData[];
    const data = result[0].json;
    expect(data.action).toBe("search");
    expect(data.count).toBe(1);
    const emails = data.emails as IDataObject[];
    expect(emails[0].id).toBe("page-1");
    expect(emails[0].subject).toBe("テストメール");
    expect(emails[0].from).toBe("sender@example.com");
    expect(emails[0].date).toBe("2026-03-17T10:00:00");
    expect(emails[0].importance).toBe("重要");
    expect(emails[0].snippet).toBe("本文の一部");
    expect(emails[0].status).toBe("未読");
    expect(emails[0].reason).toBe("重要な案件");
    expect(emails[0].url).toBe("https://notion.so/page-1");
  });

  it("件名が未設定の場合「(無題)」を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: makePage({ 件名: { title: [] } }) }],
    });

    const result = formatSearch() as INodeExecutionData[];
    const emails = result[0].json.emails as IDataObject[];
    expect(emails[0].subject).toBe("(無題)");
  });

  it("結果が空の場合、空配列とcount=0を返す", () => {
    vi.stubGlobal("$input", {
      all: () => [],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(0);
    expect(result[0].json.emails).toEqual([]);
  });

  it("複数ページで正しいcountを返す", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: makePage() },
        {
          json: {
            ...makePage(),
            id: "page-2",
            url: "https://notion.so/page-2",
          },
        },
      ],
    });

    const result = formatSearch() as INodeExecutionData[];
    expect(result[0].json.count).toBe(2);
    expect((result[0].json.emails as IDataObject[]).length).toBe(2);
  });
});
