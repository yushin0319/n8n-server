export default function (): CodeNodeReturn {
  const results = ($input.first().json.results || []) as IDataObject[];
  if (results.length === 0) {
    return [{ json: { hasDue: false } }];
  }
  const items = results.map((page: IDataObject) => {
    const props = page.properties as Record<string, IDataObject>;
    const titleEntry = Object.entries(props).find(
      ([_k, v]) => v.type === "title",
    );
    const titleArr = titleEntry ? (titleEntry[1].title as IDataObject[]) : [];
    const taskName =
      titleArr.length > 0
        ? titleArr.map((t: IDataObject) => t.plain_text).join("")
        : "(無題)";
    const freqSelect = props["頻度"]?.multi_select as IDataObject[] | undefined;
    const frequency = (freqSelect?.[0]?.name as string) || "monthly";
    const richText = (props["テンプレ本文"]?.rich_text || []) as IDataObject[];
    const templateText = richText
      .map((t: IDataObject) => t.plain_text)
      .join("");
    const defPageId = page.id;
    return {
      json: { hasDue: true, defPageId, taskName, frequency, templateText },
    };
  });
  return items;
}
