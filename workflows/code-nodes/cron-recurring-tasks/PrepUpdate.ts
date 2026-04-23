const INTERVAL_DAYS: Record<string, number> = {
  daily: 1,
  every_3_days: 3,
  weekly: 7,
  biweekly: 14,
};

function toJstDate(iso: string): Date {
  // JST の日付文字列 (YYYY-MM-DD or ISO) を UTC 基準の Date として扱う
  const datePart = iso.split("T")[0];
  return new Date(`${datePart}T00:00:00Z`);
}

function formatJst(d: Date): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
}

export default function (): CodeNodeReturn {
  const items = $input.all();
  const originals = $("ParseDueTasks").all();
  const today = formatJst(new Date(Date.now()));
  const todayDate = toJstDate(today);
  return items.map((_item, i) => {
    const original = originals[i].json as {
      defPageId: string;
      taskName: string;
      frequency: string;
      currentNextDate?: string;
    };
    // 元の次回予定日からインクリメントすることで曜日を固定する
    // WF が遅延発火してもズレない。初回（currentNextDate 未設定）は today をベースにする
    const base =
      original.currentNextDate && original.currentNextDate.length > 0
        ? toJstDate(original.currentNextDate)
        : todayDate;
    const next = new Date(base.getTime());
    if (original.frequency === "monthly") {
      next.setUTCMonth(next.getUTCMonth() + 1);
    } else {
      const days = INTERVAL_DAYS[original.frequency] ?? 30;
      next.setUTCDate(next.getUTCDate() + days);
    }
    // 加算後も過去のままなら「次の未来日」までキャッチアップ（複数回分の連続生成は避ける）
    while (next.getTime() <= todayDate.getTime()) {
      if (original.frequency === "monthly") {
        next.setUTCMonth(next.getUTCMonth() + 1);
      } else {
        const days = INTERVAL_DAYS[original.frequency] ?? 30;
        next.setUTCDate(next.getUTCDate() + days);
      }
    }
    return {
      json: {
        pageId: original.defPageId,
        taskName: original.taskName,
        lastExecuted: today,
        nextDate: next.toISOString().split("T")[0],
      },
    };
  });
}
