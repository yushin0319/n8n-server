/** Sentry project slug → repo 名のマッピング */
const PROJECT_TO_REPO: Record<string, string> = {
  shirankedo: "shirankedo",
  "worldpulse-api": "WorldPulse",
  "swipe-persona-api": "swipe-persona",
  "crypto-ai-trader-runner": "crypto-ai-trader",
  "n8n-server": "n8n-server",
};

const LEVEL_TO_SEVERITY: Record<string, "critical" | "warning" | "info"> = {
  fatal: "critical",
  error: "warning",
  warning: "warning",
  info: "info",
  debug: "info",
};

export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const data = (body.data as IDataObject) || {};
  const issue = (data.issue as IDataObject) || {};
  const event = (data.event as IDataObject) || {};
  const errorObj = (data.error as IDataObject) || {};
  const issueMeta = (issue.metadata as IDataObject | undefined) || {};
  const eventMeta = (event.metadata as IDataObject | undefined) || {};
  const errorMeta = (errorObj.metadata as IDataObject | undefined) || {};

  const title =
    (issue.title as string) ||
    (event.title as string) ||
    (errorObj.title as string) ||
    (issueMeta.value as string) ||
    (eventMeta.value as string) ||
    (errorMeta.value as string) ||
    (issueMeta.type as string) ||
    (eventMeta.type as string) ||
    (errorMeta.type as string) ||
    "";

  const level =
    (issue.level as string) ||
    (event.level as string) ||
    (errorObj.level as string) ||
    "error";
  const url =
    (issue.permalink as string) ||
    (event.web_url as string) ||
    (event.url as string) ||
    (errorObj.web_url as string) ||
    (errorObj.url as string) ||
    "";
  const projectSlug =
    ((issue.project as IDataObject | undefined)?.slug as string) ||
    (event.project_slug as string) ||
    (errorObj.project_slug as string) ||
    "";
  const repo = PROJECT_TO_REPO[projectSlug];

  if (!title) {
    // 想定外の Sentry payload 形式: throw せず warning で受け流して人間が判別できる
    // subject + raw_payload で Notion DB に残す。後で adapter に対応形式を追加する判断材料に。
    const action = (body.action as string) || "unknown";
    const id =
      (issue.id as string) ||
      (event.event_id as string) ||
      (errorObj.event_id as string) ||
      "?";
    const out: IDataObject = {
      severity: "warning",
      service: "sentry",
      subject: `⚠ Sentry unknown event payload (action=${action}, id=${id})`,
      summary:
        "ConvertSentry が title を抽出できませんでした。raw_payload で形式を確認してください。",
      raw_payload: body,
    };
    if (repo) out.repo = repo;
    return [{ json: out }];
  }

  const severity = LEVEL_TO_SEVERITY[level] ?? "warning";
  const out: IDataObject = {
    severity,
    service: "sentry",
    subject: `🐛 ${title}`,
    summary: `level=${level} project=${projectSlug || "unknown"}`,
    raw_payload: body,
  };
  if (url) out.url = url;
  if (repo) out.repo = repo;
  return [{ json: out }];
}
