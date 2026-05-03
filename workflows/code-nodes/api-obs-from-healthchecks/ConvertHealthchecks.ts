export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const name = body.name as string;
  const status = (body.status as string) || "down";
  const url = body.url as string | undefined;

  if (!name) {
    throw new Error("Healthchecks payload missing 'name'");
  }

  const severity: "critical" | "warning" | "info" =
    status === "down" ? "warning" : status === "up" ? "info" : "warning";

  const subject = severity === "info" ? `✅ ${name} UP` : `⚠ ${name} DOWN`;

  const out: IDataObject = {
    severity,
    service: "healthchecks",
    subject,
    summary: `status=${status} tags=${(body.tags as string) || ""}`,
    raw_payload: body,
  };
  if (url) out.url = url;

  return [{ json: out }];
}
