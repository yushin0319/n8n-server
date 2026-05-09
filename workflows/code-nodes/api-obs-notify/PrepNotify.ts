const OBS_DB_ID = "3552570f-e49f-80a6-9186-c1a14b7d9547";
const NOTION_TEXT_LIMIT = 2000;
const DISCORD_TITLE_LIMIT = 256;
const DISCORD_DESC_LIMIT = 4096;

const COLOR_MAP: Record<string, number> = {
  critical: 0xe74c3c,
  warning: 0xf1c40f,
  info: 0x3498db,
};

const ALLOWED_SEVERITY = ["critical", "warning", "info"];

const ALLOWED_SERVICE = [
  "n8n",
  "observability-tail",
  "cf-worker",
  "crypto-ai-trader",
  "sentry",
  "healthchecks",
  "uptime-kuma",
  "netdata",
  "github-actions",
];

const ALLOWED_REPO = [
  "n8n-server",
  "shirankedo",
  "WorldPulse",
  "swipe-persona",
  "crypto-ai-trader",
  "observability-tail",
  "kakuho",
  "dotclaude",
  "multi-agent",
];

export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const severity = body.severity as string;
  const service = body.service as string;
  const subject = body.subject as string;
  const repo = (body.repo as string) || "";

  if (!ALLOWED_SEVERITY.includes(severity)) {
    throw new Error(`severity must be one of: ${ALLOWED_SEVERITY.join(" | ")}`);
  }
  if (!ALLOWED_SERVICE.includes(service)) {
    throw new Error(`service must be one of: ${ALLOWED_SERVICE.join(" | ")}`);
  }
  if (typeof subject !== "string" || !subject) {
    throw new Error("subject is required (string)");
  }
  if (repo && !ALLOWED_REPO.includes(repo)) {
    throw new Error(`repo must be one of: ${ALLOWED_REPO.join(" | ")}`);
  }

  const channel = `obs-${severity}`;
  const envKey = `OBS_WEBHOOK_${severity.toUpperCase()}_URL`;
  // Notion #558: SendDiscord (HTTP Request) の URL expression で $env が読めず
  // "URL parameter must be a string, got undefined" が 5/9 で 10 件発火していた。
  // Code Node 経由なら N8N_BLOCK_ENV_ACCESS_IN_NODE=false で確実に読めるため、
  // ここで discordUrl を組み立てて下流に渡す (URL expression は $json.discordUrl で参照)。
  // env 未設定時は空文字。SendDiscord 側 neverError=true で WF は続行する。
  const discordUrl =
    typeof $env !== "undefined" && $env[envKey] ? String($env[envKey]) : "";

  const summary = (body.summary as string) || "";
  const rawUrl = (body.url as string) || "";
  // adapter 側のガード漏れに備えた二重保険: 非 http(s) URL は Discord/Notion 共に弾く。
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : "";
  const rawPayload = body.raw_payload;
  const rawPayloadStr =
    typeof rawPayload === "string"
      ? rawPayload
      : rawPayload === undefined || rawPayload === null
        ? ""
        : JSON.stringify(rawPayload);

  const timestampIso = new Date().toISOString();

  const discordEmbed: IDataObject = {
    title: subject.slice(0, DISCORD_TITLE_LIMIT),
    description: summary.slice(0, DISCORD_DESC_LIMIT),
    color: COLOR_MAP[severity],
    timestamp: timestampIso,
    footer: { text: `${service}${repo ? ` · ${repo}` : ""}` },
  };
  if (url) discordEmbed.url = url;

  const discordBody: IDataObject = { embeds: [discordEmbed] };
  if (severity === "critical") discordBody.content = "@here";

  const notionProps: IDataObject = {
    subject: {
      title: [{ text: { content: subject.slice(0, NOTION_TEXT_LIMIT) } }],
    },
    severity: { select: { name: severity } },
    service: { select: { name: service } },
    discord_channel: { select: { name: channel } },
    timestamp: { date: { start: timestampIso } },
  };
  if (repo) notionProps.repo = { select: { name: repo } };
  if (summary) {
    notionProps.summary = {
      rich_text: [{ text: { content: summary.slice(0, NOTION_TEXT_LIMIT) } }],
    };
  }
  if (rawPayloadStr) {
    notionProps.raw_payload = {
      rich_text: [
        { text: { content: rawPayloadStr.slice(0, NOTION_TEXT_LIMIT) } },
      ],
    };
  }
  if (url) notionProps.url = { url };

  const notionBody: IDataObject = {
    parent: { database_id: OBS_DB_ID },
    properties: notionProps,
  };

  return [
    {
      json: {
        severity,
        service,
        channel,
        envKey,
        discordUrl,
        discordBody: JSON.stringify(discordBody),
        notionBody: JSON.stringify(notionBody),
      },
    },
  ];
}
