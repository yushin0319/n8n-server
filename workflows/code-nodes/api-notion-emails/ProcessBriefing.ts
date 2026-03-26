import {
  notionDate,
  notionRichText,
  notionSelect,
  notionTitle,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const importantEmails: IDataObject[] = [];
  const unclassifiedEmails: IDataObject[] = [];
  const allPageIds: string[] = [];

  for (const item of $input.all()) {
    const page = item.json as IDataObject;
    if (!page.properties) continue;
    const props = page.properties as IDataObject;
    const subject = notionTitle(props, "subject", "(無題)");
    const from = notionRichText(props, "sender");
    const date = notionDate(props, "date");
    const importance = notionSelect(props, "importance", "未設定");
    const snippet = notionRichText(props, "snippet");
    const reason = notionRichText(props, "reason");
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
