import {
  notionDate,
  notionRichText,
  notionSelect,
  notionTitle,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const emails = results.map((page: IDataObject) => {
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
  return [{ json: { action: "search", count: emails.length, emails } }];
}
