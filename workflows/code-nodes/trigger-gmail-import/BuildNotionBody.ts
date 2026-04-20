import { parseOpenRouterText } from "../_shared/openrouter";

export default function (): CodeNodeReturn {
  const classifyResponse = $input.first().json;
  const emailData = $("PrepareClassify").first().json.emails as IDataObject[];

  let classifications: IDataObject[] = [];
  const responseText = parseOpenRouterText(classifyResponse);
  try {
    const parsed = JSON.parse(responseText as string);
    if (Array.isArray(parsed)) {
      classifications = parsed;
    } else if (Array.isArray((parsed as any)?.classifications)) {
      classifications = (parsed as any).classifications;
    }
  } catch (_e) {
    // JSONでないレスポンスは配列抽出でフォールバック
    const jsonMatch = (responseText as string).match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        classifications = JSON.parse(jsonMatch[0]);
      } catch (_) {
        classifications = [];
      }
    }
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
