import { describe, expect, it } from "vitest";
import {
  buildGeminiRequest,
  mockGeminiResponse,
  parseGeminiJson,
  parseGeminiText,
} from "./gemini";

describe("buildGeminiRequest", () => {
  it("プロンプトからGemini APIリクエストJSONを生成する", () => {
    const body = buildGeminiRequest({ prompt: "テスト指示" });
    const parsed = JSON.parse(body);

    expect(parsed.contents).toHaveLength(1);
    expect(parsed.contents[0].parts[0].text).toBe("テスト指示");
    expect(parsed.generationConfig.responseMimeType).toBe("application/json");
  });

  it("temperatureを指定できる", () => {
    const body = buildGeminiRequest({ prompt: "test", temperature: 0.8 });
    const parsed = JSON.parse(body);
    expect(parsed.generationConfig.temperature).toBe(0.8);
  });

  it("デフォルトtemperatureは0.3", () => {
    const body = buildGeminiRequest({ prompt: "test" });
    const parsed = JSON.parse(body);
    expect(parsed.generationConfig.temperature).toBe(0.3);
  });

  it("maxOutputTokensを指定できる", () => {
    const body = buildGeminiRequest({
      prompt: "test",
      maxOutputTokens: 8192,
    });
    const parsed = JSON.parse(body);
    expect(parsed.generationConfig.maxOutputTokens).toBe(8192);
  });
});

describe("parseGeminiJson", () => {
  it("正常なGeminiレスポンスからJSONをパースする", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: '{"result": "ok"}' }] } }],
    };
    const result = parseGeminiJson<{ result: string }>(response);
    expect(result).toEqual({ result: "ok" });
  });

  it("レスポンスが空ならエラーを投げる", () => {
    expect(() => parseGeminiJson({})).toThrow();
  });

  it("JSONパースに失敗したらエラーを投げる", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "not json" }] } }],
    };
    expect(() => parseGeminiJson(response)).toThrow("JSONパース失敗");
  });

  it("配列のJSONもパースできる", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "[1, 2, 3]" }] } }],
    };
    const result = parseGeminiJson<number[]>(response);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("parseGeminiText", () => {
  it("正常なレスポンスからテキストを取得する", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "こんにちは" }] } }],
    };
    expect(parseGeminiText(response)).toBe("こんにちは");
  });

  it("空レスポンスはデフォルトで空文字を返す", () => {
    expect(parseGeminiText({})).toBe("");
  });

  it("fallback指定時は空レスポンスでfallbackを返す", () => {
    expect(parseGeminiText({}, "生成失敗")).toBe("生成失敗");
  });

  it("テキストが存在する場合はfallbackを無視する", () => {
    const response = {
      candidates: [{ content: { parts: [{ text: "OK" }] } }],
    };
    expect(parseGeminiText(response, "生成失敗")).toBe("OK");
  });
});

describe("mockGeminiResponse", () => {
  it("Geminiレスポンス構造を生成する", () => {
    const resp = mockGeminiResponse("hello");
    expect(resp.candidates).toBeDefined();
    expect((resp as any).candidates[0].content.parts[0].text).toBe("hello");
  });

  it("parseGeminiTextで読み取れる", () => {
    const resp = mockGeminiResponse("テスト");
    expect(parseGeminiText(resp as IDataObject)).toBe("テスト");
  });

  it("parseGeminiJsonで読み取れる", () => {
    const resp = mockGeminiResponse('{"key": "value"}');
    expect(parseGeminiJson(resp as IDataObject)).toEqual({ key: "value" });
  });
});
