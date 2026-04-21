import { beforeEach, describe, expect, it, vi } from "vitest";
import validateClassify from "./ValidateClassify";

function openRouterResponse(text: string) {
  return {
    choices: [{ message: { role: "assistant", content: text } }],
  };
}

describe("ValidateClassify", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常レスポンスから classifications 配列を返す", () => {
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

    const result = validateClassify() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.classifications).toEqual([
      { index: 1, importance: "重要" },
      { index: 2, importance: "不要" },
    ]);
  });

  it("壊れ JSON（importance 欠落）で例外を投げ、continueErrorOutput で次段へ回す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: openRouterResponse('{"classifications":[{"index":1,"":"不要"}]}'),
      }),
    });
    expect(() => validateClassify()).toThrow();
  });
});
