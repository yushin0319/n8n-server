import { describe, expect, it } from "vitest";
import { buildGeminiRequest, parseGeminiJson } from "./gemini";

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
      candidates: [
        { content: { parts: [{ text: '{"result": "ok"}' }] } },
      ],
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
