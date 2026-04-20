import { beforeEach, describe, expect, it, vi } from "vitest";
import prepareClassify from "./PrepareClassify";

describe("PrepareClassify", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("空の入力で空配列を返す", () => {
    vi.stubGlobal("$input", { all: () => [] });
    const result = prepareClassify();
    expect(result).toEqual([]);
  });

  it("メールからqwenBody/gemmaBody/emails配列を生成する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            Subject: "テスト件名",
            From: "test@example.com",
            snippet: "これはテスト",
            id: "msg-001",
            internalDate: "1700000000000",
          },
        },
      ],
    });

    const result = prepareClassify() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    const data = result[0].json;

    const emails = data.emails as IDataObject[];
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("テスト件名");
    expect(emails[0].from).toBe("test@example.com");
    expect(emails[0].messageId).toBe("msg-001");

    const qwen = JSON.parse(data.qwenBody as string);
    expect(qwen.model).toBe("qwen/qwen3-next-80b-a3b-instruct:free");
    expect(qwen.messages[0].content).toContain("テスト件名");
    expect(qwen.temperature).toBe(0.1);
    expect(qwen.response_format).toEqual({ type: "json_object" });

    const gemma = JSON.parse(data.gemmaBody as string);
    expect(gemma.model).toBe("google/gemma-4-31b-it:free");
    expect(gemma.messages[0].content).toContain("テスト件名");
  });

  it("Subject/Fromがない場合デフォルト値を使う", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: { id: "msg-002", date: "2024-01-01" },
        },
      ],
    });

    const result = prepareClassify() as INodeExecutionData[];
    const emails = result[0].json.emails as IDataObject[];
    expect(emails[0].subject).toBe("(件名なし)");
    expect(emails[0].from).toBe("不明");
  });
});
