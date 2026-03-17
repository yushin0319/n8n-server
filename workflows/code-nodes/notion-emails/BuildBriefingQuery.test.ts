import { describe, expect, it, vi, beforeEach } from "vitest";
import buildBriefingQuery from "./BuildBriefingQuery";

describe("BuildBriefingQuery (notion-emails)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("有効なJSONを返す", () => {
    const result = buildBriefingQuery() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.queryBody as string);
    expect(body).toBeDefined();
  });

  it("ステータス=未読のフィルタを含む", () => {
    const result = buildBriefingQuery() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.queryBody as string);
    expect(body.filter.property).toBe("ステータス");
    expect(body.filter.select.equals).toBe("未読");
  });

  it("日時の降順ソートを含む", () => {
    const result = buildBriefingQuery() as INodeExecutionData[];
    const body = JSON.parse(result[0].json.queryBody as string);
    expect(body.sorts).toHaveLength(1);
    expect(body.sorts[0].property).toBe("日時");
    expect(body.sorts[0].direction).toBe("descending");
  });
});
