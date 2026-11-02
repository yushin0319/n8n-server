/**
 * 事前に ValidateClassify / MockClassify で抽出された
 * `{ classifications: [{index, importance}, ...] }` を受け取り、
 * Notion ページ作成用のリクエストボディを組み立てる.
 *
 * classify のパース失敗は ValidateClassify 側で検知し、
 * そこで continueErrorOutput → 次段 classify にフォールバックする設計.
 * 重要度は前後の空白を削り、重要・確認・不要以外（無い・空を含む）は「確認」にする
 * (Notion は知らない名前を渡されると新しい選択肢を作り、ブリーフィングの「重要・確認」から漏れるため).
 */
const IMPORTANCE = ["重要", "確認", "不要"];

export default function (): CodeNodeReturn {
  const classifications =
    ($input.first().json.classifications as IDataObject[]) || [];
  const emailData = $("PrepareClassify").first().json.emails as IDataObject[];

  const classMap: Record<number, string> = {};
  for (const c of classifications) {
    classMap[c.index as number] = String(c.importance ?? "").trim();
  }

  return emailData.map((email, i) => {
    const raw = classMap[i + 1];
    const importance = IMPORTANCE.includes(raw) ? raw : "確認";
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
        messageId: {
          rich_text: [{ text: { content: (email.messageId as string) || "" } }],
        },
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
