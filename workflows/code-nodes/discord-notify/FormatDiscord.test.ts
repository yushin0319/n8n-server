import { describe, expect, it, vi, beforeEach } from "vitest";
import formatDiscord from "./FormatDiscord";

/** テスト用: CodeNodeReturn を配列として扱う */
function callAndGetItems() {
  const result = formatDiscord();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatDiscord", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("messageフィールドを含むアイテムを1つ返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { message: "hello" } } }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0].json.message).toBe("hello");
  });

  it("body.messageがない場合デフォルトメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    const items = callAndGetItems();

    expect(items[0].json.message).toBe("No message provided");
  });

  it("body.messageが空文字の場合デフォルトメッセージを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { message: "" } } }),
    });

    const items = callAndGetItems();

    expect(items[0].json.message).toBe("No message provided");
  });
});
