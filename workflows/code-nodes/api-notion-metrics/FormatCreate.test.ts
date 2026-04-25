import { describe, expect, it, vi } from "vitest";
import formatCreate from "./FormatCreate";

interface CreateOutput {
  action: string;
  id: string | null;
  url: string | null;
  created_time: string | null;
}

function setup(json: Record<string, unknown>) {
  vi.stubGlobal("$input", {
    first: () => ({ json }),
  });
}

function run(): CreateOutput {
  const result = formatCreate();
  const arr = Array.isArray(result) ? result : [result];
  return (arr[0] as { json: CreateOutput }).json;
}

describe("FormatCreate", () => {
  it("Notion ページから id/url/created_time を抜き出す", () => {
    setup({
      id: "page-xyz",
      url: "https://notion.so/page-xyz",
      created_time: "2026-04-25T09:00:00Z",
    });
    const out = run();
    expect(out.action).toBe("create");
    expect(out.id).toBe("page-xyz");
    expect(out.url).toBe("https://notion.so/page-xyz");
    expect(out.created_time).toBe("2026-04-25T09:00:00Z");
  });

  it("欠損プロパティは null", () => {
    setup({});
    const out = run();
    expect(out.id).toBeNull();
    expect(out.url).toBeNull();
    expect(out.created_time).toBeNull();
  });
});
