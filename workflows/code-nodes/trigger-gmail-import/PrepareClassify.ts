import { buildGeminiRequest } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  const items = $input.all();
  if (items.length === 0) return [];

  const emails: IDataObject[] = [];
  for (const item of items) {
    const e = item.json;
    const subject = (
      (e.Subject as string) ||
      (e.subject as string) ||
      "(件名なし)"
    ).substring(0, 200);
    const from = (e.From as string) || (e.from as string) || "不明";
    const snippet = ((e.snippet as string) || "").substring(0, 300);
    const messageId = e.id;
    let dateISO: string;
    try {
      const ts = e.internalDate ? Number(e.internalDate) : null;
      dateISO = ts
        ? new Date(ts).toISOString()
        : e.date
          ? new Date(e.date as string).toISOString()
          : new Date().toISOString();
    } catch (_) {
      dateISO = new Date().toISOString();
    }
    emails.push({ subject, from, snippet, messageId, dateISO });
  }

  const emailList = emails
    .map(
      (e, i) =>
        `${i + 1}. 件名: ${e.subject}, 差出人: ${e.from}, スニペット: ${e.snippet}`,
    )
    .join("\n");

  const prompt = `以下のメール一覧を「重要」「不要」「確認」に分類してください。

分類基準:
- 重要: 銀行・金融通知、インフラ関連（Oracle Cloud, AWS等）、セキュリティ関連、個人宛の重要連絡
- 不要: 広告・宣伝メール、自動通知（GitHub等）、飲食店プロモーション、ポイント付与通知
- 確認: 上記のどちらにも明確に該当しないもの

メール一覧:
${emailList}

JSON配列で返答してください（他のテキストは不要）:
[{"index": 1, "importance": "重要"}, {"index": 2, "importance": "不要"}, ...]`;

  const geminiBody = buildGeminiRequest({
    prompt,
    temperature: 0.1,
    maxOutputTokens: 1000,
  });

  return [{ json: { geminiBody, emails } }];
}
