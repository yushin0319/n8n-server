import {
  notionDate,
  notionRichText,
  notionSelect,
  notionTitle,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const importantEmails: IDataObject[] = [];
  const unclassifiedEmails: IDataObject[] = [];
  const allPageIds: string[] = [];

  for (const page of results) {
    const props = page.properties as IDataObject;
    const subject = notionTitle(props, "件名", "(無題)");
    const from = notionRichText(props, "差出人");
    const date = notionDate(props, "日時");
    const importance = notionSelect(props, "重要度", "未設定");
    const snippet = notionRichText(props, "スニペット");
    const reason = notionRichText(props, "理由");
    const emailData = {
      id: page.id,
      subject,
      from,
      date,
      importance,
      snippet,
      reason,
      url: page.url,
    };
    if (importance === "重要") {
      importantEmails.push(emailData);
    } else if (importance === "確認") {
      unclassifiedEmails.push(emailData);
    }
    allPageIds.push(page.id as string);
  }

  const briefingResponse = {
    action: "briefing",
    important: { count: importantEmails.length, emails: importantEmails },
    unclassified: {
      count: unclassifiedEmails.length,
      emails: unclassifiedEmails,
    },
    marked_read_count: allPageIds.length,
  };
  return [{ json: { briefingResponse, allPageIds } }];
}
