export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const heartbeat = (body.heartbeat as IDataObject) || {};
  const monitor = (body.monitor as IDataObject) || {};
  const name = monitor.name as string;

  if (!name) {
    // 想定外の Uptime Kuma payload (test_notification 等は monitor を含まない)。
    // throw せず warning で受け流し、raw_payload を Notion DB に残す。
    return [
      {
        json: {
          severity: "warning",
          service: "uptime-kuma",
          subject: "⚠ Uptime Kuma unknown payload (monitor.name 欠如)",
          summary:
            "test_notification 等の簡易 payload か未対応形式。raw_payload で確認してください。",
          raw_payload: body,
        },
      },
    ];
  }

  const status = heartbeat.status as number | undefined;
  // 0 DOWN, 1 UP, 2 PENDING, 3 MAINTENANCE
  // n8n heartbeat の push monitor は EventLoopBlocked 由来の tick 遅着で一瞬 DOWN 判定 →
  // 自己回復する flap が多い (非アクショナブル)。実 hard-down は n8n-watchdog + Healthchecks
  // が別途 warning で捕捉するため、この monitor の DOWN/PENDING は info に格下げして
  // #obs-warning の ping を止める。他 monitor (n8n HTTP / crypto-ai-trader 等) は従来通り。
  const isDownish = status !== 1 && status !== 3;
  const isFlappyN8nHeartbeat = isDownish && /n8n heartbeat/i.test(name);
  const severity: "critical" | "warning" | "info" =
    status === 1 || status === 3 || isFlappyN8nHeartbeat ? "info" : "warning";
  const stateLabel =
    status === 1
      ? "UP"
      : status === 3
        ? "MAINTENANCE"
        : status === 2
          ? "PENDING"
          : "DOWN";

  // emoji は severity ではなく実状態ベース: info 格下げされた DOWN も「⚠ ... DOWN」と表示する
  const emoji = status === 1 || status === 3 ? "✅" : "⚠";
  const subject = `${emoji} ${name} ${stateLabel}`;

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
