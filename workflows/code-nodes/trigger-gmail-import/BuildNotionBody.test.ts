import { beforeEach, describe, expect, it, vi } from "vitest";
import buildNotionBody from "./BuildNotionBody";

describe("BuildNotionBody", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("事前パース済み classifications から Notion ボディを組み立てる", () => {
    const emails = [
      {
        subject: "銀行通知",
        from: "bank@example.com",
        snippet: "口座",
        messageId: "msg-1",
        dateISO: "2024-01-01T00:00:00.000Z",
      },
      {
        subject: "広告",
        from: "ads@example.com",
        snippet: "セール",
        messageId: "msg-2",
        dateISO: "2024-01-02T00:00:00.000Z",
      },
    ];

    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          classifications: [
            { index: 1, importance: "重要" },
            { index: 2, importance: "不要" },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { emails } }),
    }));

    const result = buildNotionBody() as INodeExecutionData[];
    expect(result).toHaveLength(2);
    const body1 = JSON.parse(result[0].json.requestBody as string);
    expect(body1.properties.importance.select.name).toBe("重要");
    const body2 = JSON.parse(result[1].json.requestBody as string);
    expect(body2.properties.importance.select.name).toBe("不要");
  });

  it("classifications が空なら全て『確認』を使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { classifications: [] } }),
    });
    vi.stubGlobal("$", () => ({
      first: () => ({
        json: {
          emails: [
            {
              subject: "test",
              from: "a@b.com",
              snippet: "",
              messageId: "m1",
              dateISO: "2024-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    }));

    const result = buildNotionBody() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.importance.select.name).toBe("確認");
  });

  it("classifications キーが欠落していても『確認』で埋める", () => {
    vi.stubGlobal("$input", { first: () => ({ json: {} }) });
    vi.stubGlobal("$", () => ({
      first: () => ({
        json: {
          emails: [
            {
              subject: "t",
              from: "a@b.com",
              snippet: "",
              messageId: "m1",
              dateISO: "2024-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    }));
    const result = buildNotionBody() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties.importance.select.name).toBe("確認");
  });
});
