import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCreate from "./PrepCreate";

describe("PrepCreate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("タスク名を含むNotionページ作成ボディを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { name: "テストタスク" } },
      }),
    });

    const result = prepCreate() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties[""].title[0].text.content).toBe("テストタスク");
    expect(body.parent.database_id).toBe(
      "2a02570f-e49f-802b-a67c-fe4c230a5699",
    );
    expect(body.cover).toBeDefined();
  });

  it("名前がない場合デフォルト名を使う", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { body: {} } }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties[""].title[0].text.content).toBe("新しいタスク");
  });

  it("parent_idがある場合親タスクリレーションを設定する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { body: { name: "子タスク", parent_id: "parent-123" } },
      }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.properties["親タスク"].relation[0].id).toBe("parent-123");
  });

  it("contentがある場合childrenブロックを含む", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { name: "タスク", content: "## 見出し\n- 項目1" },
        },
      }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.children).toHaveLength(2);
    expect(body.children[0].type).toBe("heading_2");
    expect(body.children[1].type).toBe("bulleted_list_item");
  });

  it("cover_urlを指定できる", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          body: { name: "タスク", cover_url: "https://example.com/img.jpg" },
        },
      }),
    });

    const result = prepCreate() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.requestBody as string);
    expect(body.cover.external.url).toBe("https://example.com/img.jpg");
  });
});
