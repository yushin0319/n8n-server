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

  it("メールからgeminiBodyとemails配列を生成する", () => {
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

    // emails配列の検証
    const emails = data.emails as IDataObject[];
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("テスト件名");
    expect(emails[0].from).toBe("test@example.com");
    expect(emails[0].messageId).toBe("msg-001");

    // geminiBodyがJSON文字列であること
    const parsed = JSON.parse(data.geminiBody as string);
    expect(parsed.contents[0].parts[0].text).toContain("テスト件名");
    expect(parsed.generationConfig.temperature).toBe(0.1);
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
