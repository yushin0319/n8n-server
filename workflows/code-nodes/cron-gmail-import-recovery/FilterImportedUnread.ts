import { notionRichTextSet } from "../_shared/notionProps";

/**
 * Notion には登録済みなのに Gmail では未読のまま残ったメールを拾う。
 * gmail-import は CreateNotionPage → MarkAsRead の順なので、途中で止まると
 * （Notion の速度制限・実行の停止など）Notion にだけ入って既読にならない。
 * FilterUnimported は Notion に無いものしか拾わないため、ここで既読化の対象を出す。
 */
export default function (): CodeNodeReturn {
  const gmailItems = $("GmailGetMany").all();
  const notionMessageIds = notionRichTextSet($input.all(), "messageId");

  return gmailItems.filter((item) => {
    const id = item.json?.id as string | undefined;
    // simple: true の Gmail ノードは labelIds を labels: [{ id, name }] に変換して返す
    const labels = (item.json?.labels as IDataObject[] | undefined) ?? [];
    return (
      typeof id === "string" &&
      notionMessageIds.has(id) &&
      labels.some((label) => label.id === "UNREAD")
    );
  });
}
