import { describe, expect, it, vi, beforeEach } from "vitest";
import prepQuery from "./PrepQuery";

function callAndGetItems() {
  const result = prepQuery();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepQuery", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // 2026-03-17 00:00:00 UTC → JST 2026-03-17 09:00
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-17T00:00:00Z").getTime(),
    );
  });

  it("有効=trueかつ次回予定日<=今日のフィルタをJSON文字列で返す", () => {
    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    const parsed = JSON.parse(items[0].json.requestBody as string);

    expect(parsed.filter.and).toHaveLength(2);
    expect(parsed.filter.and[0]).toEqual({
      property: "有効",
      checkbox: { equals: true },
    });
    expect(parsed.filter.and[1]).toEqual({
      property: "次回予定日",
      date: { on_or_before: "2026-03-17" },
    });
  });
});
