import { describe, expect, it, vi, beforeEach } from "vitest";
import prepReplaceAppend from "./PrepReplaceAppend";

describe("PrepReplaceAppend", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("PrepReplaceのデータからcontentBodyを生成する", () => {
    vi.stubGlobal("$", (name: string) => ({
      first: () => ({
        json: { pageId: "page-789", taskContent: "- item1\n- item2" },
      }),
    }));

    const result = prepReplaceAppend() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.pageId).toBe("page-789");

    const contentBody = JSON.parse(result[0].json.contentBody as string);
    expect(contentBody.children).toHaveLength(2);
    expect(contentBody.children[0].type).toBe("bulleted_list_item");
  });
});
