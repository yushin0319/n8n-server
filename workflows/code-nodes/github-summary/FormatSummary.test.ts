import { beforeEach, describe, expect, it, vi } from "vitest";
import formatSummary from "./FormatSummary";

function callAndGetItems() {
  const result = formatSummary();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatSummary", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // Date.now を固定（2026-03-17 00:00:00 UTC → JST 09:00）
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-03-17T00:00:00Z").getTime(),
    );
  });

  it("コミットをリポジトリ別にグループ化してNotionブロックを生成する", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          items: [
            {
              repository: { full_name: "user/repo-a" },
              commit: { message: "fix: bug fix\ndetails" },
            },
            {
              repository: { full_name: "user/repo-a" },
              commit: { message: "feat: new feature" },
            },
            {
              repository: { full_name: "user/repo-b" },
              commit: { message: "docs: update readme" },
            },
          ],
        },
      }),
    });

    const items = callAndGetItems();

    expect(items).toHaveLength(1);
    const parsed = JSON.parse(items[0].json.requestBody as string);

    // タイトルにJST日付が入る
    expect(items[0].json.title).toBe("GitHub活動 2026-03-17");
    expect(items[0].json.totalCommits).toBe(3);

    // children: heading_3 x2 + bulleted_list_item x3
    expect(parsed.children).toHaveLength(5);
    expect(parsed.children[0].type).toBe("heading_3");
    expect(parsed.children[0].heading_3.rich_text[0].text.content).toBe(
      "user/repo-a",
    );
    // コミットメッセージは1行目のみ
    expect(
      parsed.children[1].bulleted_list_item.rich_text[0].text.content,
    ).toBe("fix: bug fix");
  });

  it("コミットが0件の場合、childrenが空になる", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: { items: [] } }),
    });

    const items = callAndGetItems();
    const parsed = JSON.parse(items[0].json.requestBody as string);

    expect(items[0].json.totalCommits).toBe(0);
    expect(parsed.children).toHaveLength(0);
  });

  it("itemsがundefinedの場合も0件として処理する", () => {
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });

    const items = callAndGetItems();
    expect(items[0].json.totalCommits).toBe(0);
  });
});
