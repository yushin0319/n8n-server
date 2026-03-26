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
    const subject = notionTitle(props, "subject", "(無題)");
    const from = notionRichText(props, "sender");
    const date = notionDate(props, "date");
    const importance = notionSelect(props, "importance", "未設定");
    const snippet = notionRichText(props, "snippet");
    const status = notionSelect(props, "status", "未設定");
    const reason = notionRichText(props, "reason");
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
