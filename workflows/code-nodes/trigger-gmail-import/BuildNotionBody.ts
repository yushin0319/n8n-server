/**
 * 事前に ValidateClassify / MockClassify で抽出された
 * `{ classifications: [{index, importance}, ...] }` を受け取り、
 * Notion ページ作成用のリクエストボディを組み立てる.
 *
 * classify のパース失敗は ValidateClassify 側で検知し、
 * そこで continueErrorOutput → 次段 classify にフォールバックする設計.
 * BuildNotionBody は classifications が無い / 空ならデフォルト「確認」を使う.
 */
export default function (): CodeNodeReturn {
  const classifications =
    ($input.first().json.classifications as IDataObject[]) || [];
  const emailData = $("PrepareClassify").first().json.emails as IDataObject[];

  const classMap: Record<number, string> = {};
  for (const c of classifications) {
    classMap[c.index as number] = c.importance as string;
  }

  return emailData.map((email, i) => {
    const importance = classMap[i + 1] || "確認";
    const body = {
      parent: { database_id: "2ff2570f-e49f-8119-aaaf-f688605e5aa3" },
      properties: {
        subject: { title: [{ text: { content: email.subject } }] },
        sender: {
          rich_text: [
            { text: { content: (email.from as string).substring(0, 2000) } },
          ],
        },
        date: { date: { start: email.dateISO } },
        importance: { select: { name: importance } },
        snippet: { rich_text: [{ text: { content: email.snippet } }] },
        status: { select: { name: "未読" } },
      },
    };
    return {
      json: {
        requestBody: JSON.stringify(body),
        messageId: email.messageId,
      },
    };
  });
}
