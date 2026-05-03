import { beforeEach, describe, expect, it, vi } from "vitest";
import formatResponse from "./FormatResponse";

function callAndGetItems() {
  const result = formatResponse();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatResponse", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("成功時: properties キー一覧と件数を返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          object: "database",
          id: "abc",
          title: [{ plain_text: "観測性ログ" }],
          properties: {
            subject: {},
            severity: {},
            service: {},
          },
        },
      }),
    });

    const items = callAndGetItems();

    expect(items[0].json.success).toBe(true);
    expect(items[0].json.database_id).toBe("abc");
    expect(items[0].json.property_count).toBe(3);
    expect(items[0].json.properties).toEqual([
      "subject",
      "severity",
      "service",
    ]);
  });

  it("成功時: properties 空 でも property_count=0 / properties=[]", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { object: "database", id: "x", properties: {} },
      }),
    });

    const items = callAndGetItems();
    expect(items[0].json.success).toBe(true);
    expect(items[0].json.property_count).toBe(0);
    expect(items[0].json.properties).toEqual([]);
  });

  it("成功時: properties 欠如でも property_count=0", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { object: "database", id: "x" } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.property_count).toBe(0);
    expect(items[0].json.properties).toEqual([]);
  });

  it("Notion error は透過して success=false", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          object: "error",
          code: "validation_error",
          message: "title parameter invalid",
          status: 400,
        },
      }),
    });

    const items = callAndGetItems();

    expect(items[0].json.success).toBe(false);
    expect(items[0].json.error).toMatchObject({
      code: "validation_error",
      status: 400,
    });
  });

  it("error フィールド欠如時のフォールバック", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { object: "error" } }),
    });

    const items = callAndGetItems();
    expect(items[0].json.success).toBe(false);
    expect(items[0].json.error).toEqual({
      code: "unknown",
      message: "Notion API error",
      status: null,
    });
  });
});
