import { beforeEach, describe, expect, it } from "vitest";
import { checkTestMode } from "./checkTestMode";

// $execution.customData のモック
const customData = new Map<string, string>();
const mockExecution = {
  customData: {
    set: (key: string, value: string) => customData.set(key, value),
    get: (key: string) => customData.get(key),
  },
};

describe("checkTestMode", () => {
  beforeEach(() => {
    customData.clear();
  });

  it("Webhook経由（test:true）なら isTest='true' をセットする", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: {}, body: { test: true } } },
    ];
    const result = checkTestMode(items, mockExecution as any);

    expect(customData.get("isTest")).toBe("true");
    expect(result).toEqual(items);
  });

  it("Webhook経由（test:false）なら isTest='false' をセットする", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: {}, body: { test: false } } },
    ];
    const result = checkTestMode(items, mockExecution as any);

    expect(customData.get("isTest")).toBe("false");
    expect(result).toEqual(items);
  });

  it("Schedule経由（bodyなし）なら isTest='false' をセットする", () => {
    const items: INodeExecutionData[] = [{ json: {} }];
    const result = checkTestMode(items, mockExecution as any);

    expect(customData.get("isTest")).toBe("false");
    expect(result).toEqual(items);
  });

  it("入力アイテムをそのままパススルーする", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: {}, body: { test: true } } },
      { json: { someData: "value" } },
    ];
    const result = checkTestMode(items, mockExecution as any);

    expect(result).toEqual(items);
    expect(result).toHaveLength(2);
  });

  it("bodyがあるがtestプロパティがない場合は isTest='false'", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: {}, body: { action: "run" } } },
    ];
    checkTestMode(items, mockExecution as any);

    expect(customData.get("isTest")).toBe("false");
  });
});
