import { notionDate, notionSelect, notionTitle } from "../_shared/notionProps";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const DISCORD_DESC_LIMIT = 4096;
const MAX_ALERT_GROUPS = 15;
const MAX_TRADES = 20;

const COLOR_CRITICAL = 0xe74c3c;
const COLOR_WARNING = 0xf1c40f;
const COLOR_TRADE_ONLY = 0x3498db;

interface ObsRecord {
  severity: string;
  service: string;
  subject: string;
  ms: number;
}

interface AlertGroup {
  service: string;
  subject: string;
  count: number;
  latestMs: number;
}

// Task Runner では toLocaleString のタイムゾーン指定が効かないため +9h で JST 化する
function jstIso(ms: number): string {
  return new Date(ms + JST_OFFSET_MS).toISOString();
}

/** "MM/DD HH:MM"（JST） */
function jstShort(ms: number): string {
  const iso = jstIso(ms);
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

function groupAlerts(records: ObsRecord[]): AlertGroup[] {
  const groups = new Map<string, AlertGroup>();
  for (const r of records) {
    const key = `${r.service}::${r.subject}`;
    const g = groups.get(key);
    if (g) {
      g.count += 1;
      g.latestMs = Math.max(g.latestMs, r.ms);
    } else {
      groups.set(key, {
        service: r.service,
        subject: r.subject,
        count: 1,
        latestMs: r.ms,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.latestMs - a.latestMs);
}

function alertLines(groups: AlertGroup[]): string[] {
  const lines = groups
    .slice(0, MAX_ALERT_GROUPS)
    .map(
      (g) =>
        `• ${g.service}: ${g.subject} ×${g.count}（最終 ${jstShort(g.latestMs)}）`,
    );
  if (groups.length > MAX_ALERT_GROUPS) {
    lines.push(`…他 ${groups.length - MAX_ALERT_GROUPS} 種類`);
  }
  return lines;
}

/**
 * 観測性 DB の query 結果を日次まとめ 1 通分の Discord embed に整形する。
 * warning も約定も無い日は skip=true を返し、下流の IF で送信しない。
 */
export default function (): CodeNodeReturn {
  const resp = $input.first().json as IDataObject;
  // Notion 障害を「平和な 1 日」と誤読させないため、0 件扱いにせず落とす
  if (resp.object === "error") {
    throw new Error(
      `Notion query failed: ${String(resp.code ?? "unknown")} ${String(resp.message ?? "")}`,
    );
  }

  // timestamp は "…Z" と "…+00:00" が混在するので、ここで一度だけ数値化する
  const records: ObsRecord[] = (
    (resp.results as IDataObject[] | undefined) ?? []
  ).map((p) => {
    const props = (p.properties ?? {}) as IDataObject;
    return {
      severity: notionSelect(props, "severity"),
      service: notionSelect(props, "service"),
      subject: notionTitle(props, "subject", "").trim(),
      ms: new Date(notionDate(props, "timestamp")).getTime(),
    };
  });

  const criticals = records.filter((r) => r.severity === "critical");
  const warnings = records.filter((r) => r.severity === "warning");
  // info は BuildQuery で crypto-ai-trader の分だけに絞っている（= 約定）
  const trades = records.filter((r) => r.severity === "info");

  const skip =
    warnings.length === 0 && criticals.length === 0 && trades.length === 0;

  const discordUrl =
    typeof $env !== "undefined" && $env.OBS_WEBHOOK_WARNING_URL
      ? String($env.OBS_WEBHOOK_WARNING_URL)
      : "";
  if (!skip && !discordUrl) {
    throw new Error(
      "OBS_WEBHOOK_WARNING_URL is not set; daily digest cannot be delivered",
    );
  }

  const sections: string[] = [];
  if (criticals.length > 0) {
    sections.push(
      [
        `**🚨 critical ${criticals.length} 件**（即時通知済み）`,
        ...alertLines(groupAlerts(criticals)),
      ].join("\n"),
    );
  }
  if (warnings.length > 0) {
    const groups = groupAlerts(warnings);
    sections.push(
      [
        `**⚠️ warning ${warnings.length} 件 / ${groups.length} 種類**`,
        ...alertLines(groups),
      ].join("\n"),
    );
  }
  if (trades.length > 0) {
    const lines = trades
      .slice(0, MAX_TRADES)
      .map((t) => `• ${jstShort(t.ms)} ${t.subject}`);
    if (trades.length > MAX_TRADES)
      lines.push(`…他 ${trades.length - MAX_TRADES} 件`);
    sections.push([`**💱 売買 ${trades.length} 件**`, ...lines].join("\n"));
  }
  if (resp.has_more === true) {
    sections.push(
      "※ 対象が 100 件を超えたため一部省略。全件は観測性 DB を参照",
    );
  }

  let description = sections.join("\n\n");
  if (description.length > DISCORD_DESC_LIMIT) {
    description = `${description.slice(0, DISCORD_DESC_LIMIT - 1)}…`;
  }

  const now = Date.now();
  const color =
    criticals.length > 0
      ? COLOR_CRITICAL
      : warnings.length > 0
        ? COLOR_WARNING
        : COLOR_TRADE_ONLY;
  const embed: IDataObject = {
    title: `🗒️ 日次まとめ ${jstIso(now).slice(0, 10)}`,
    description,
    color,
    footer: {
      text: `対象: ${jstShort(now - WINDOW_MS)}〜${jstShort(now)} JST`,
    },
  };

  return [
    {
      json: {
        skip,
        criticalCount: criticals.length,
        warningCount: warnings.length,
        tradeCount: trades.length,
        discordUrl,
        discordBody: JSON.stringify({ embeds: [embed] }),
      },
    },
  ];
}
