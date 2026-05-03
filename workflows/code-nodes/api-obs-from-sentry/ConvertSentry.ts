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
  // issue / event のどちらかから抽出
  const title = (issue.title as string) || (event.title as string) || "";
  const level = (issue.level as string) || (event.level as string) || "error";
  const url =
    (issue.permalink as string) ||
    (event.web_url as string) ||
    (event.url as string) ||
    "";
  const projectSlug =
    ((issue.project as IDataObject | undefined)?.slug as string) ||
    (event.project_slug as string) ||
    "";

  if (!title) {
    throw new Error(
      "Sentry payload missing data.issue.title / data.event.title",
    );
  }

  const severity = LEVEL_TO_SEVERITY[level] ?? "warning";
  const repo = PROJECT_TO_REPO[projectSlug];

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
