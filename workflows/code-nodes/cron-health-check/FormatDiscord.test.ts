import { describe, expect, it, vi } from "vitest";
import formatDiscord from "./FormatDiscord";

function callAndGetItems() {
  const result = formatDiscord();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("FormatDiscord", () => {
  it("obs-notify schema (severity=warning, service=n8n) を返す", () => {
    const out = callAndGetItems()[0].json;
    expect(out.severity).toBe("warning");
    expect(out.service).toBe("n8n");
    expect(out.subject).toContain("HistLink Backend DOWN");
    expect(out.subject).toContain("❌");
  });

  it("summary に日時 + 失敗文字列を含む", () => {
    const out = callAndGetItems()[0].json;
    expect(out.summary).toContain("にヘルスチェックが失敗しました。");
  });

  it("summary に日時が入る", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T10:30:00+09:00"));
    const out = callAndGetItems()[0].json;
    expect(out.summary).toMatch(/2026/);
    vi.useRealTimers();
  });
});
