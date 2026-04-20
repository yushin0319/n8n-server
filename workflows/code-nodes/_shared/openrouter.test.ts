import { describe, expect, it } from "vitest";
import {
  buildOpenRouterRequest,
  mockOpenRouterResponse,
  parseOpenRouterJson,
  parseOpenRouterText,
} from "./openrouter";

describe("buildOpenRouterRequest", () => {
  it("プロンプトとモデルからOpenAI互換リクエストJSONを生成する", () => {
    const body = buildOpenRouterRequest({
      prompt: "テスト指示",
      model: "qwen/qwen3-30b-a3b:free",
    });
    const parsed = JSON.parse(body);

    expect(parsed.model).toBe("qwen/qwen3-30b-a3b:free");
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].role).toBe("user");
    expect(parsed.messages[0].content).toBe("テスト指示");
    expect(parsed.response_format).toEqual({ type: "json_object" });
  });

  it("temperature を指定できる", () => {
    const body = buildOpenRouterRequest({
      prompt: "t",
      model: "m",
      temperature: 0.8,
    });
    expect(JSON.parse(body).temperature).toBe(0.8);
  });

  it("デフォルト temperature は 0.3", () => {
    const body = buildOpenRouterRequest({ prompt: "t", model: "m" });
    expect(JSON.parse(body).temperature).toBe(0.3);
  });

  it("maxTokens を指定できる", () => {
    const body = buildOpenRouterRequest({
      prompt: "t",
      model: "m",
      maxTokens: 500,
    });
    expect(JSON.parse(body).max_tokens).toBe(500);
  });

  it("jsonMode=false で response_format を省略する", () => {
    const body = buildOpenRouterRequest({
      prompt: "t",
      model: "m",
      jsonMode: false,
    });
    expect(JSON.parse(body).response_format).toBeUndefined();
  });
});

describe("parseOpenRouterJson", () => {
  it("正常なレスポンスからJSONをパースする", () => {
    const response = {
      choices: [{ message: { content: '{"result": "ok"}' } }],
    };
    const result = parseOpenRouterJson<{ result: string }>(response);
    expect(result).toEqual({ result: "ok" });
  });

  it("レスポンスが空ならエラーを投げる", () => {
    expect(() => parseOpenRouterJson({})).toThrow();
  });

  it("JSONパースに失敗したらエラーを投げる", () => {
    const response = {
      choices: [{ message: { content: "not json" } }],
    };
    expect(() => parseOpenRouterJson(response)).toThrow("JSONパース失敗");
  });
});

describe("parseOpenRouterText", () => {
  it("正常なレスポンスからテキストを取得する", () => {
    const response = {
      choices: [{ message: { content: "こんにちは" } }],
    };
    expect(parseOpenRouterText(response)).toBe("こんにちは");
  });

  it("空レスポンスはデフォルトで空文字を返す", () => {
    expect(parseOpenRouterText({})).toBe("");
  });

  it("fallback指定時は空レスポンスでfallbackを返す", () => {
    expect(parseOpenRouterText({}, "生成失敗")).toBe("生成失敗");
  });
});

describe("mockOpenRouterResponse", () => {
  it("OpenRouterレスポンス構造を生成する", () => {
    const resp = mockOpenRouterResponse("hello");
    expect((resp as any).choices[0].message.content).toBe("hello");
  });

  it("parseOpenRouterText で読み取れる", () => {
    const resp = mockOpenRouterResponse("テスト");
    expect(parseOpenRouterText(resp as IDataObject)).toBe("テスト");
  });

  it("parseOpenRouterJson で読み取れる", () => {
    const resp = mockOpenRouterResponse('{"key": "value"}');
    expect(parseOpenRouterJson(resp as IDataObject)).toEqual({ key: "value" });
  });
});
