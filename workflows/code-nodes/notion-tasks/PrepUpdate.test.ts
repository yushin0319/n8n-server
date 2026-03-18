import { beforeEach, describe, expect, it, vi } from "vitest";
import prepUpdate from "./PrepUpdate";

describe("PrepUpdate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("page_id がない場合エラーをスローする", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    expect(() => prepUpdate()).toThrow("page_id is required for update action");
  });

  it("name プロパティを設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", name: "新タスク名" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties[""]).toEqual({
      title: [{ text: { content: "新タスク名" } }],
    });
  });

  it("status プロパティを設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", status: "完了" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["ステータス"]).toEqual({
      status: { name: "完了" },
    });
  });

  it("parent_id を設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", parent_id: "parent-1" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["親タスク"]).toEqual({
      relation: [{ id: "parent-1" }],
    });
  });

  it("parent_id が空の場合リレーションをクリアする", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { page_id: "page-1", parent_id: "" } },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["親タスク"]).toEqual({ relation: [] });
  });

  it("cover_url を含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: {
            page_id: "page-1",
            cover_url: "https://example.com/image.png",
          },
        },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.cover).toEqual({
      type: "external",
      external: { url: "https://example.com/image.png" },
    });
  });

  it("content を含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { page_id: "page-1", content: "タスクの内容" },
        },
      }),
    });

    const result = prepUpdate() as INodeExecutionData[];
    expect(result[0].json.content).toBe("タスクの内容");
    expect(result[0].json.pageId).toBe("page-1");
  });
});
