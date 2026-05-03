import { beforeEach, describe, expect, it, vi } from "vitest";
import prepRequest from "./PrepRequest";

function callAndGetItems() {
  const result = prepRequest();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepRequest", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常系: database_id と properties から PATCH URL と body を構築", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            database_id: "abc123",
            properties: { Name: { title: {} } },
          },
        },
      }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    expect(items[0].json.url).toBe(
      "https://api.notion.com/v1/databases/abc123",
    );
    expect(JSON.parse(items[0].json.requestBody as string)).toEqual({
      properties: { Name: { title: {} } },
    });
  });

  it("database_id 欠如で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { properties: {} } } }),
    });
    expect(() => prepRequest()).toThrow("database_id is required");
  });

  it("database_id 空文字で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { database_id: "", properties: {} } } }),
    });
    expect(() => prepRequest()).toThrow("database_id is required");
  });

  it("properties 欠如で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: { database_id: "a" } } }),
    });
    expect(() => prepRequest()).toThrow("properties is required");
  });

  it("properties null で throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { database_id: "a", properties: null } },
      }),
    });
    expect(() => prepRequest()).toThrow("properties is required");
  });

  it("body 欠如で database_id エラー", () => {
    vi.stubGlobal("$input", { first: () => ({ json: {} }) });
    expect(() => prepRequest()).toThrow("database_id is required");
  });
});
