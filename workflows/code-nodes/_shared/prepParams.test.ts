import { describe, expect, it } from "vitest";
import { prepParams } from "./prepParams";

describe("prepParams", () => {
  it("必須フィールドを取り出す", () => {
    const body = { file_id: "abc123" };
    const result = prepParams(body, { required: ["file_id"] });
    expect(result).toEqual({ file_id: "abc123" });
  });

  it("必須フィールドがない場合エラーオブジェクトを返す", () => {
    const body = {};
    const result = prepParams(body, { required: ["file_id"] });
    expect(result).toEqual({ _error: true, message: "file_id is required" });
  });

  it("任意フィールドにデフォルト値を適用する", () => {
    const body = { file_id: "abc" };
    const result = prepParams(body, {
      required: ["file_id"],
      optional: { role: "reader", type: "anyone" },
    });
    expect(result).toEqual({ file_id: "abc", role: "reader", type: "anyone" });
  });

  it("任意フィールドが指定されていればそちらを使う", () => {
    const body = { file_id: "abc", role: "writer" };
    const result = prepParams(body, {
      required: ["file_id"],
      optional: { role: "reader" },
    });
    expect(result).toEqual({ file_id: "abc", role: "writer" });
  });

  it("複数の必須フィールドをチェックする", () => {
    const body = { file_id: "abc" };
    const result = prepParams(body, { required: ["file_id", "folder_id"] });
    expect(result).toEqual({ _error: true, message: "folder_id is required" });
  });

  it("必須も任意もなければ空オブジェクトを返す", () => {
    const result = prepParams({}, {});
    expect(result).toEqual({});
  });
});
