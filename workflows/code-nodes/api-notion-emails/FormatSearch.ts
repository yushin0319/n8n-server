import {
  notionDate,
  notionRichText,
  notionSelect,
  notionTitle,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const emails = $input.all().map((item) => {
    const page = item.json as IDataObject;
    const props = page.properties as IDataObject;
    const subject = notionTitle(props, "件名", "(無題)");
    const from = notionRichText(props, "差出人");
    const date = notionDate(props, "日時");
    const importance = notionSelect(props, "重要度", "未設定");
    const snippet = notionRichText(props, "スニペット");
    const status = notionSelect(props, "ステータス", "未設定");
    const reason = notionRichText(props, "理由");
    return {
      id: page.id,
      subject,
      from,
      date,
      importance,
      snippet,
      status,
      reason,
      url: page.url,
    };
  });
  // ネイティブノードのソートオプションがDB schema照合で不安定なためJS側でソート
  const toTime = (d: unknown): number => {
    if (!d) return 0;
    const t = new Date(d as string).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  emails.sort((a, b) => toTime(b.date) - toTime(a.date));
  // PrepSearchのlimit指定があれば適用
  const limit = $("PrepSearch").first().json.limit as number | undefined;
  const limited = limit ? emails.slice(0, limit) : emails;
  return [
    { json: { action: "search", count: limited.length, emails: limited } },
  ];
}
