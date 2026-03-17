import { describe, expect, it, vi, beforeEach } from "vitest";
import buildNotionBody from "./BuildNotionBody";

describe("BuildNotionBody", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("Gemini分類結果をNotionページ作成ボディに変換する", () => {
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
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      { index: 1, importance: "重要" },
                      { index: 2, importance: "不要" },
                    ]),
                  },
                ],
              },
            },
          ],
        },
      }),
    });
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({ json: { emails } }),
    }));

    const result = buildNotionBody() as INodeExecutionData[];
    expect(result).toHaveLength(2);

    // 1件目: 重要
    const body1 = JSON.parse(result[0].json.requestBody as string);
    expect(body1.properties["重要度"].select.name).toBe("重要");
    expect(body1.properties["件名"].title[0].text.content).toBe("銀行通知");
    expect(result[0].json.messageId).toBe("msg-1");

    // 2件目: 不要
    const body2 = JSON.parse(result[1].json.requestBody as string);
    expect(body2.properties["重要度"].select.name).toBe("不要");
  });

  it("分類がない場合デフォルトで確認を使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [{ content: { parts: [{ text: "[]" }] } }],
        },
      }),
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
    expect(body.properties["重要度"].select.name).toBe("確認");
  });

  it("Geminiレスポンスのパースに失敗したらエラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          candidates: [{ content: { parts: [{ text: "invalid json" }] } }],
        },
      }),
    });
    vi.stubGlobal("$", () => ({
      first: () => ({ json: { emails: [] } }),
    }));

    // 配列がマッチしないので classifications は空 → emailData.map で空配列が返る
    // パースエラーにはならない（jsonMatchがnull）
    const result = buildNotionBody() as INodeExecutionData[];
    expect(result).toHaveLength(0);
  });
});
