import { notionRichText } from "../_shared/notionProps";

/**
 * Gmail は messageId のみ突き合わせる単純な set difference だが、
 * Notion 側で同一 messageId の重複登録を作らないよう、空/欠落値は照合対象から除外する。
 */
export default function (): CodeNodeReturn {
  const gmailItems = $("GmailGetMany").all();
  const notionResponse =
    ($input.first()?.json as IDataObject | undefined) ?? {};
  const results = (notionResponse.results as IDataObject[] | undefined) ?? [];

  const notionMessageIds = new Set<string>();
  for (const page of results) {
    const props = (page.properties as IDataObject | undefined) ?? {};
    const text = notionRichText(props, "messageId");
    if (text) notionMessageIds.add(text);
  }

  return gmailItems.filter((item) => {
    const id = item.json?.id as string | undefined;
    return typeof id === "string" && id.length > 0 && !notionMessageIds.has(id);
  });
}
