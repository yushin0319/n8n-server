import { beforeEach, describe, expect, it, vi } from "vitest";
import formatResponse from "./FormatResponse";

/** テスト用: CodeNodeReturn を配列として扱う */
function callAndGetItems() {
  const result = formatResponse();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatResponse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("success: trueとmessageを含むレスポンスを返す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatDiscord") {
        return { first: () => ({ json: { message: "test message" } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0].json.success).toBe(true);
    expect(items[0].json.message).toBe("test message");
  });

  it("FormatDiscordのmessageをそのまま返す", () => {
    vi.stubGlobal("$", (nodeName: string) => {
      if (nodeName === "FormatDiscord") {
        return { first: () => ({ json: { message: "日本語メッセージ" } }) };
      }
      throw new Error(`Unknown node: ${nodeName}`);
    });

    const items = callAndGetItems();

    expect(items[0].json.message).toBe("日本語メッセージ");
  });
});
