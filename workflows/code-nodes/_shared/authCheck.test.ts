import { describe, expect, it } from "vitest";
import { authCheck } from "./authCheck";

describe("authCheck", () => {
  it("正しいsecretならアイテムをそのまま返す", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: { "x-webhook-secret": "correct-secret" }, body: {} } },
    ];
    const result = authCheck(items, "correct-secret");
    expect(result).toEqual(items);
  });

  it("不正なsecretならエラーを投げる", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: { "x-webhook-secret": "wrong" }, body: {} } },
    ];
    expect(() => authCheck(items, "correct-secret")).toThrow("Forbidden");
  });

  it("secretヘッダーがない場合もエラーを投げる", () => {
    const items: INodeExecutionData[] = [
      { json: { headers: {}, body: {} } },
    ];
    expect(() => authCheck(items, "correct-secret")).toThrow("Forbidden");
  });
});
