import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCreate from "./PrepCreate";

function callAndGetItems() {
  const result = prepCreate();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("PrepCreate", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("タスクごとにNotionページ作成用のリクエストボディを生成する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            taskName: "週次レビュー",
            templateText: "レビュー内容を記入",
            frequency: "weekly",
          },
        },
      ],
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(1);

    const parsed = JSON.parse(items[0].json.requestBody as string);
    expect(parsed.parent.database_id).toBe(
      "2a02570f-e49f-802b-a67c-fe4c230a5699",
    );
    expect(parsed.properties[""].title[0].text.content).toBe("週次レビュー");
    expect(parsed.properties.ステータス.status.name).toBe("未着手");
    expect(parsed.cover.type).toBe("external");
    // テンプレ本文があるのでchildrenが含まれる
    expect(parsed.children).toHaveLength(1);
    expect(parsed.children[0].paragraph.rich_text[0].text.content).toBe(
      "レビュー内容を記入",
    );
  });

  it("テンプレ本文が空の場合childrenは含まれない", () => {
    vi.stubGlobal("$input", {
      all: () => [
        {
          json: {
            taskName: "シンプルタスク",
            templateText: "",
            frequency: "daily",
          },
        },
      ],
    });

    const items = callAndGetItems();
    const parsed = JSON.parse(items[0].json.requestBody as string);
    expect(parsed.children).toBeUndefined();
  });

  it("複数アイテムを処理する", () => {
    vi.stubGlobal("$input", {
      all: () => [
        { json: { taskName: "タスク1", templateText: "", frequency: "daily" } },
        {
          json: {
            taskName: "タスク2",
            templateText: "内容",
            frequency: "weekly",
          },
        },
      ],
    });

    const items = callAndGetItems();
    expect(items).toHaveLength(2);
  });
});
