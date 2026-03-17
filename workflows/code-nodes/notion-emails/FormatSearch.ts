export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const emails = results.map((page: IDataObject) => {
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
    const status =
      ((props["ステータス"] as IDataObject)?.select as IDataObject)?.name ||
      "未設定";
    const reason =
      (((props["理由"] as IDataObject)?.rich_text as IDataObject[]) || [])
        .map((t: IDataObject) => t.plain_text)
        .join("") || "";
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
