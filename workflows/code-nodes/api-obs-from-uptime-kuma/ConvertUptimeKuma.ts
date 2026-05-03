export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const heartbeat = (body.heartbeat as IDataObject) || {};
  const monitor = (body.monitor as IDataObject) || {};
  const name = monitor.name as string;

  if (!name) {
    throw new Error("Uptime Kuma payload missing monitor.name");
  }

  const status = heartbeat.status as number | undefined;
  // 0 DOWN, 1 UP, 2 PENDING, 3 MAINTENANCE
  const severity: "critical" | "warning" | "info" =
    status === 1 ? "info" : status === 3 ? "info" : "warning";
  const stateLabel =
    status === 1
      ? "UP"
      : status === 3
        ? "MAINTENANCE"
        : status === 2
          ? "PENDING"
          : "DOWN";

  const subject =
    severity === "info"
      ? `✅ ${name} ${stateLabel}`
      : `⚠ ${name} ${stateLabel}`;

  const out: IDataObject = {
    severity,
    service: "uptime-kuma",
    subject,
    summary: (heartbeat.msg as string) || (body.msg as string) || "",
    raw_payload: body,
  };
  if (monitor.url) out.url = monitor.url as string;

  return [{ json: out }];
}
