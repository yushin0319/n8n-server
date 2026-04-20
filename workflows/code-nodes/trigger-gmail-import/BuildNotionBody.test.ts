import { beforeEach, describe, expect, it, vi } from "vitest";
import buildNotionBody from "./BuildNotionBody";

function openRouterResponse(text: string): unknown {
  return {
    choices: [{ message: { role: "assistant", content: text } }],
  };
}

function geminiResponse(text: string): unknown {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  };
}

describe("BuildNotionBody", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("OpenRouter形式のJSONオブジェクトレスポンスをNotionボディに変換する", () => {
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
        json: openRouterResponse(
          JSON.stringify({
            classifications: [
              { index: 1, importance: "重要" },
              { index: 2, importance: "不要" },
            ],
          }),
        ),
      }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { emails } }),
    }));

    const result = buildNotionBody() as INodeExecutionData[];
    expect(result).toHaveLength(2);
    const body1 = JSON.parse(result[0].json.requestBody as string);
    expect(body1.properties["importance"].select.name).toBe("重要");
    const body2 = JSON.parse(result[1].json.requestBody as string);
    expect(body2.properties["importance"].select.name).toBe("不要");
  });

  it("Gemini形式のレスポンスも同じロジックで変換できる", () => {
    const emails = [
      {
        subject: "セキュリティ通知",
        from: "sec@example.com",
        snippet: "ログイン",
        messageId: "msg-g1",
        dateISO: "2024-01-03T00:00:00.000Z",
      },
    ];

    vi.stubGlobal("$input", {
      first: () => ({
        json: geminiResponse(
          JSON.stringify({
            classifications: [{ index: 1, importance: "重要" }],
          }),
        ),
      }),
    });
    vi.stubGlobal("$", () => ({ first: () => ({ json: { emails } }) }));

    const result = buildNotionBody() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["importance"].select.name).toBe("重要");
  });

  it("素の配列レスポンス（OpenRouter）にもフォールバック対応する", () => {
    const emails = [
      {
        subject: "t",
        from: "a@b.com",
        snippet: "",
        messageId: "m1",
        dateISO: "2024-01-01T00:00:00.000Z",
      },
    ];
    vi.stubGlobal("$input", {
      first: () => ({
        json: openRouterResponse(
          JSON.stringify([{ index: 1, importance: "重要" }]),
        ),
      }),
    });
    vi.stubGlobal("$", () => ({ first: () => ({ json: { emails } }) }));

    const result = buildNotionBody() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["importance"].select.name).toBe("重要");
  });

  it("分類がない場合デフォルトで確認を使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: openRouterResponse(JSON.stringify({ classifications: [] })),
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
    expect(body.properties["importance"].select.name).toBe("確認");
  });

  it("レスポンスがinvalid JSONでエラーを投げる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: openRouterResponse("invalid json") }),
    });
    vi.stubGlobal("$", () => ({
      first: () => ({ json: { emails: [] } }),
    }));

    expect(() => buildNotionBody()).toThrow(
      "BuildNotionBody: 分類結果のパースに失敗",
    );
  });
});
