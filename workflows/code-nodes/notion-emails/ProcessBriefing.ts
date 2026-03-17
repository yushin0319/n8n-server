export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const importantEmails: IDataObject[] = [];
  const unclassifiedEmails: IDataObject[] = [];
  const allPageIds: string[] = [];

  for (const page of results) {
    const props = page.properties as IDataObject;
    const subject =
      (((props["件名"] as IDataObject)?.title as IDataObject[]) || [])
        .map((t: IDataObject) => t.plain_text)
        .join("") || "(無題)";
    const from =
      (((props["差出人"] as IDataObject)?.rich_text as IDataObject[]) || [])
        .map((t: IDataObject) => t.plain_text)
        .join("") || "";
    const date = (props["日時"] as IDataObject)?.date
      ? ((props["日時"] as IDataObject).date as IDataObject)?.start || ""
      : "";
    const importance =
      ((props["重要度"] as IDataObject)?.select as IDataObject)?.name ||
      "未設定";
    const snippet =
      (
        ((props["スニペット"] as IDataObject)?.rich_text as IDataObject[]) || []
      )
        .map((t: IDataObject) => t.plain_text)
        .join("") || "";
    const reason =
      (((props["理由"] as IDataObject)?.rich_text as IDataObject[]) || [])
        .map((t: IDataObject) => t.plain_text)
        .join("") || "";
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
