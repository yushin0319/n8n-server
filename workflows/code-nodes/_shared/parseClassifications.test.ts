import { describe, expect, it } from "vitest";
import { parseClassifications } from "./parseClassifications";

function openRouterResponse(text: string) {
  return {
    choices: [{ message: { role: "assistant", content: text } }],
  } as unknown as IDataObject;
}

function geminiResponse(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  } as unknown as IDataObject;
}

describe("parseClassifications", () => {
  it("OpenRouter + classifications キー形式を受理する", () => {
    const res = openRouterResponse(
      JSON.stringify({
        classifications: [
          { index: 1, importance: "重要" },
          { index: 2, importance: "不要" },
        ],
      }),
    );
    const out = parseClassifications(res);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ index: 1, importance: "重要" });
  });

  it("Gemini + 素の配列形式を受理する", () => {
    const res = geminiResponse(
      JSON.stringify([{ index: 1, importance: "確認" }]),
    );
    const out = parseClassifications(res);
    expect(out).toHaveLength(1);
    expect(out[0].importance).toBe("確認");
  });

  it("配列が文中に混在してもフォールバック抽出できる", () => {
    const res = openRouterResponse(
      '結果: [{"index":1,"importance":"重要"}] 以上',
    );
    const out = parseClassifications(res);
    expect(out[0].index).toBe(1);
  });

  it("レスポンステキストが空なら例外", () => {
    expect(() => parseClassifications({} as IDataObject)).toThrow(
      /レスポンステキストが空/,
    );
  });

  it("JSON破損で配列抽出も不可能なら例外", () => {
    const res = openRouterResponse("totally broken not json");
    expect(() => parseClassifications(res)).toThrow(
      /配列を抽出できませんでした/,
    );
  });

  it("importance キー欠落（今回の事故ケース）を検出して例外", () => {
    // exec 16727 で Gptoss が返した壊れ JSON を再現
    const broken =
      '{"classifications":[{"index":1,"importance":"不要"},{"index":2,"importance":"重要"},{"index":3,"":"重要"},{"index":4,"":"不要"}]}';
    const res = openRouterResponse(broken);
    expect(() => parseClassifications(res)).toThrow(/importance/);
  });

  it("index が number でない場合に例外", () => {
    const res = openRouterResponse(
      JSON.stringify({
        classifications: [{ index: "1", importance: "重要" }],
      }),
    );
    expect(() => parseClassifications(res)).toThrow(/index/);
  });

  it("importance が空文字列の場合に例外", () => {
    const res = openRouterResponse(
      JSON.stringify({ classifications: [{ index: 1, importance: "" }] }),
    );
    expect(() => parseClassifications(res)).toThrow(/importance/);
  });
});
