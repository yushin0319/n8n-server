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

  it("メールから4つのbodyとemails配列を生成する", () => {
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

    const qwen = JSON.parse(data.qwenBody as string);
    expect(qwen.model).toBe("qwen/qwen3-next-80b-a3b-instruct:free");
    expect(qwen.messages[0].content).toContain("テスト件名");

    const gemma = JSON.parse(data.gemmaBody as string);
    expect(gemma.model).toBe("google/gemma-4-31b-it:free");

    const gptoss = JSON.parse(data.gptossBody as string);
    expect(gptoss.model).toBe("openai/gpt-oss-20b:free");

    const gemini = JSON.parse(data.geminiBody as string);
    expect(gemini.contents[0].parts[0].text).toContain("テスト件名");
    expect(gemini.generationConfig.temperature).toBe(0.1);
  });

  it("出力上限はメール件数に比例し、92通でも打ち切られない", () => {
    // 1 通あたりの出力は約 13 トークン。2026-10-18 に 92 通を固定 1000 で投げて MAX_TOKENS になった
    const many = Array.from({ length: 92 }, (_, i) => ({
      json: { Subject: `件名${i}`, From: "a@example.com", id: `m-${i}` },
    }));
    vi.stubGlobal("$input", { all: () => many });

    const data = (prepareClassify() as INodeExecutionData[])[0].json;
    const gemini = JSON.parse(data.geminiBody as string);
    const qwen = JSON.parse(data.qwenBody as string);
    expect(gemini.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(
      92 * 15,
    );
    expect(qwen.max_tokens).toBe(gemini.generationConfig.maxOutputTokens);
  });

  it("件数が少ないときの出力上限は従来どおり 1000", () => {
    vi.stubGlobal("$input", {
      all: () => [{ json: { Subject: "s", From: "f", id: "m-1" } }],
    });
    const data = (prepareClassify() as INodeExecutionData[])[0].json;
    const gemini = JSON.parse(data.geminiBody as string);
    expect(gemini.generationConfig.maxOutputTokens).toBe(1000);
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
