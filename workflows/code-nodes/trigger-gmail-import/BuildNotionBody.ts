import { parseGeminiText } from "../_shared/gemini";
import { parseOpenRouterText } from "../_shared/openrouter";

export default function (): CodeNodeReturn {
  const classifyResponse = $input.first().json;
  const emailData = $("PrepareClassify").first().json.emails as IDataObject[];

  // OpenRouter形式とGemini形式の両方に対応（どちらで成功したか不明なので両方試す）
  const responseText =
    parseOpenRouterText(classifyResponse) || parseGeminiText(classifyResponse);

  let classifications: IDataObject[] = [];
  try {
    const parsed = JSON.parse(responseText as string);
    if (Array.isArray(parsed)) {
      classifications = parsed;
    } else if (Array.isArray((parsed as any)?.classifications)) {
      classifications = (parsed as any).classifications;
    } else {
      throw new Error(
        "BuildNotionBody: 分類結果が配列でもclassificationsキーでもない: " +
          (responseText as string).substring(0, 200),
      );
    }
  } catch (_e) {
    // JSONパース失敗時は素のテキスト内から配列を抽出してフォールバック
    const jsonMatch = (responseText as string).match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        "BuildNotionBody: 分類結果のパースに失敗（JSON形式でも配列抽出でも取得不可）: " +
          (responseText as string).substring(0, 200),
      );
    }
    try {
      classifications = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      throw new Error(
        "BuildNotionBody: 抽出した配列のパースに失敗: " + e.message,
      );
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
