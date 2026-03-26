export default function (): CodeNodeReturn {
  const items = $input.all();
  const originals = $("ParseDueTasks").all();
  return items.map((_item, i) => {
    const original = originals[i].json;
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const nextDate = new Date();
    switch (original.frequency) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case "every_3_days":
        nextDate.setDate(nextDate.getDate() + 3);
        break;
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "biweekly":
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    const nextDue = new Date(nextDate.getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return {
      json: {
        pageId: original.defPageId,
        taskName: original.taskName,
        lastExecuted: today,
        nextDate: nextDue,
      },
    };
  });
}
