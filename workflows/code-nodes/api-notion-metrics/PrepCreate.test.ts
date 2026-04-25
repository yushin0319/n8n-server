import { describe, expect, it, vi } from "vitest";
import prepCreate from "./PrepCreate";

interface PrepOutput {
  requestBody: string;
}

interface NotionBody {
  parent: { database_id: string };
  properties: Record<string, IDataObject>;
}

function setup(body: Record<string, unknown>) {
  vi.stubGlobal("$input", {
    first: () => ({ json: { body } }),
  });
}

function run(): NotionBody {
  const result = prepCreate();
  const items = Array.isArray(result) ? result : [result];
  const out = (items[0] as { json: PrepOutput }).json;
  return JSON.parse(out.requestBody);
}

describe("PrepCreate", () => {
  it("最低限の入力で日付Title + parent が出る", () => {
    setup({});
    const body = run();
    expect(body.parent.database_id).toBe(
      "34d2570f-e49f-800e-82f8-dca2c6b1f1d3",
    );
    expect((body.properties["日付"].title as IDataObject[])[0]).toMatchObject({
      text: { content: expect.any(String) },
    });
  });

  it("date を指定すれば反映される", () => {
    setup({ date: "2026-04-25" });
    const body = run();
    expect(
      (body.properties["日付"].title as IDataObject[])[0].text,
    ).toMatchObject({
      content: "2026-04-25",
    });
  });

  it("数値プロパティを number 型で組む", () => {
    setup({
      date: "2026-04-25",
      total: 600,
      success: 599,
      error: 1,
      error_rate_pct: 0.17,
    });
    const body = run();
    expect(body.properties.total).toEqual({ number: 600 });
    expect(body.properties.success).toEqual({ number: 599 });
    expect(body.properties.error).toEqual({ number: 1 });
    expect(body.properties.error_rate_pct).toEqual({ number: 0.17 });
  });

  it("rich_text プロパティを組む", () => {
    setup({
      date: "2026-04-25",
      top_wf: "cron/x: 100\ncron/y: 50",
    });
    const body = run();
    expect(
      (body.properties.top_wf.rich_text as IDataObject[])[0].text,
    ).toMatchObject({
      content: "cron/x: 100\ncron/y: 50",
    });
  });

  it("空文字列の rich_text は省略する", () => {
    setup({
      date: "2026-04-25",
      top_wf: "",
      recent_errors: "",
    });
    const body = run();
    expect(body.properties.top_wf).toBeUndefined();
    expect(body.properties.recent_errors).toBeUndefined();
  });

  it("body 直下でも properties.body 経由でも同じ結果", () => {
    setup({ date: "2026-04-25", total: 100 });
    const a = run();

    vi.stubGlobal("$input", {
      first: () => ({ json: { date: "2026-04-25", total: 100 } }),
    });
    const b = JSON.parse(
      (prepCreate() as INodeExecutionData[])[0].json.requestBody as string,
    );
    expect(a).toEqual(b);
  });
});
