import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import aggregateAndFormat from "./AggregateAndFormat";

const WARNING_URL = "https://discord.example/webhooks/W/W";

// Notion API の query 結果ページ（観測性 DB のプロパティ形）
function page(
  severity: string,
  service: string,
  subject: string,
  timestamp: string,
): IDataObject {
  return {
    object: "page",
    properties: {
      subject: { type: "title", title: [{ plain_text: subject }] },
      severity: { type: "select", select: { name: severity } },
      service: { type: "select", select: { name: service } },
      timestamp: { type: "date", date: { start: timestamp } },
    },
  };
}

function stubResponse(results: IDataObject[], extra: IDataObject = {}) {
  vi.stubGlobal("$input", {
    first: () => ({
      json: { object: "list", results, has_more: false, ...extra },
    }),
  });
}

function run() {
  const result = aggregateAndFormat();
  const items = Array.isArray(result) ? result : [result];
  return (items as INodeExecutionData[])[0].json;
}

function embedOf(out: IDataObject) {
  return JSON.parse(out.discordBody as string).embeds[0];
}

describe("AggregateAndFormat", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("$env", { OBS_WEBHOOK_WARNING_URL: WARNING_URL });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T14:00:00.000Z")); // 23:00 JST
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warning を service+subject で集約し、件数と最終時刻 (JST) を出す", () => {
    stubResponse([
      page(
        "warning",
        "uptime-kuma",
        "⚠ crypto-ai-trader heartbeat DOWN",
        "2026-09-29T21:21:00.000+00:00",
      ),
      page("warning", "n8n", "❌ n8n エラー (abc)", "2026-09-30T03:00:00.000Z"),
      page(
        "warning",
        "uptime-kuma",
        "⚠ crypto-ai-trader heartbeat DOWN",
        "2026-09-30T09:40:00.000Z",
      ),
    ]);
    const out = run();
    expect(out.skip).toBe(false);
    expect(out.warningCount).toBe(3);
    expect(out.warningGroupCount).toBe(2);
    const desc = embedOf(out).description as string;
    // 最終発生の新しい順
    expect(desc.indexOf("heartbeat DOWN")).toBeLessThan(
      desc.indexOf("n8n エラー"),
    );
    expect(desc).toContain(
      "uptime-kuma: ⚠ crypto-ai-trader heartbeat DOWN ×2（最終 09/30 18:40）",
    );
    expect(desc).toContain("n8n: ❌ n8n エラー (abc) ×1（最終 09/30 12:00）");
  });

  it("最終時刻は Z / +00:00 表記が混在しても時刻として比較する", () => {
    stubResponse([
      page("warning", "n8n", "w1", "2026-09-30T09:00:00.000Z"),
      page("warning", "n8n", "w1", "2026-09-30T08:00:00.000+00:00"),
    ]);
    expect(embedOf(run()).description).toContain(
      "n8n: w1 ×2（最終 09/30 18:00）",
    );
  });

  it("crypto-ai-trader の約定は時系列順に 1 行ずつ並べる", () => {
    stubResponse([
      page(
        "info",
        "crypto-ai-trader",
        "📉 売却約定 LINK/JPY 0.7134 @ ¥2,380（損益 +¥30）",
        "2026-09-29T16:18:00.000Z",
      ),
      page(
        "info",
        "crypto-ai-trader",
        "📈 買い約定 ADA/JPY 226.8071 @ ¥39.05",
        "2026-09-30T09:44:43.000Z",
      ),
    ]);
    const out = run();
    expect(out.skip).toBe(false);
    expect(out.tradeCount).toBe(2);
    const desc = embedOf(out).description as string;
    expect(desc).toContain("09/30 01:18 📉 売却約定 LINK/JPY");
    expect(desc).toContain("09/30 18:44 📈 買い約定 ADA/JPY");
    expect(desc.indexOf("売却約定")).toBeLessThan(desc.indexOf("買い約定"));
  });

  it("critical は即時通知済みの注記つきで先頭に出し、色を赤にする", () => {
    stubResponse([
      page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z"),
      page("critical", "n8n", "n8n 全停止", "2026-09-30T02:00:00.000Z"),
    ]);
    const out = run();
    const embed = embedOf(out);
    expect(out.criticalCount).toBe(1);
    expect(embed.color).toBe(0xe74c3c);
    expect(embed.description.indexOf("critical")).toBeLessThan(
      embed.description.indexOf("warning"),
    );
    expect(embed.description).toContain("即時通知済み");
  });

  it("warning のみなら黄、約定のみなら青", () => {
    stubResponse([page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z")]);
    expect(embedOf(run()).color).toBe(0xf1c40f);
    stubResponse([
      page(
        "info",
        "crypto-ai-trader",
        "📈 買い約定 X",
        "2026-09-30T01:00:00.000Z",
      ),
    ]);
    expect(embedOf(run()).color).toBe(0x3498db);
  });

  it("タイトルに JST の日付を入れる", () => {
    stubResponse([page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z")]);
    expect(embedOf(run()).title).toBe("🗒️ 日次まとめ 2026-09-30");
  });

  it("warning も約定も 0 件なら skip=true（Discord に送らない）", () => {
    vi.stubGlobal("$env", {});
    stubResponse([]);
    const out = run();
    expect(out.skip).toBe(true);
    expect(out.warningCount).toBe(0);
    expect(out.tradeCount).toBe(0);
  });

  it("対象外の info（crypto-ai-trader 以外）は無視する", () => {
    stubResponse([page("info", "n8n", "✅ 完了", "2026-09-30T01:00:00.000Z")]);
    expect(run().skip).toBe(true);
  });

  it("warning グループが 15 を超えたら残りを『他 N 種類』にまとめる", () => {
    stubResponse(
      Array.from({ length: 18 }, (_, i) =>
        page("warning", "n8n", `w${i}`, `2026-09-30T0${i % 10}:00:00.000Z`),
      ),
    );
    const desc = embedOf(run()).description as string;
    expect(desc).toContain("他 3 種類");
  });

  it("description は Discord 上限 4096 字に収める", () => {
    stubResponse(
      Array.from({ length: 60 }, (_, i) =>
        page(
          "info",
          "crypto-ai-trader",
          `📈 買い約定 ${"X".repeat(200)} ${i}`,
          "2026-09-30T01:00:00.000Z",
        ),
      ),
    );
    expect((embedOf(run()).description as string).length).toBeLessThanOrEqual(
      4096,
    );
  });

  it("Notion の結果が 100 件を超えていたら省略がある旨を書く", () => {
    stubResponse([page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z")], {
      has_more: true,
    });
    expect(embedOf(run()).description).toContain("一部省略");
  });

  it("送る内容があるのに OBS_WEBHOOK_WARNING_URL が無ければ throw（黙って落とさない）", () => {
    vi.stubGlobal("$env", {});
    stubResponse([page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z")]);
    expect(() => run()).toThrow("OBS_WEBHOOK_WARNING_URL");
  });

  it("Notion API エラーは 0 件扱いにせず throw", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { object: "error", code: "unauthorized", message: "bad token" },
      }),
    });
    expect(() => run()).toThrow("unauthorized");
  });

  it("discordUrl と discordBody を下流に渡す", () => {
    stubResponse([page("warning", "n8n", "w1", "2026-09-30T01:00:00.000Z")]);
    const out = run();
    expect(out.discordUrl).toBe(WARNING_URL);
    expect(embedOf(out).footer.text).toContain("09/29 23:00〜09/30 23:00 JST");
  });
});
