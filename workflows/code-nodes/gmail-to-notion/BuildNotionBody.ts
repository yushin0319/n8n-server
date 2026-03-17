export default function (): CodeNodeReturn {
  const geminiResponse = $input.first().json;
  const emailData = $("PrepareClassify").first().json.emails as IDataObject[];

  let classifications: IDataObject[] = [];
  try {
    const responseText =
      (geminiResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";
    const jsonMatch = (responseText as string).match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      classifications = JSON.parse(jsonMatch[0]);
    }
  } catch (e: any) {
    throw new Error(
      "BuildNotionBody: Gemini分類結果のパースに失敗: " + e.message,
    );
  }

  const classMap: Record<number, string> = {};
  for (const c of classifications) {
    classMap[c.index as number] = (c.importance as string) || "確認";
  }

  return emailData.map((email, i) => {
    const importance = classMap[i + 1] || "確認";
    const body = {
      parent: { database_id: "2ff2570f-e49f-8119-aaaf-f688605e5aa3" },
      properties: {
        件名: { title: [{ text: { content: email.subject } }] },
        差出人: {
          rich_text: [
            { text: { content: (email.from as string).substring(0, 2000) } },
          ],
        },
        日時: { date: { start: email.dateISO } },
        重要度: { select: { name: importance } },
        スニペット: { rich_text: [{ text: { content: email.snippet } }] },
        ステータス: { select: { name: "未読" } },
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
