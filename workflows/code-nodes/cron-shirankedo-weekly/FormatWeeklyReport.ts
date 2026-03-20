import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  // Geminiレスポンスからレポートテキストを抽出
  const resp = $input.first().json;
  const reportContent: string = parseGeminiText(resp);
  if (!reportContent) {
    return [
      {
        json: {
          requestBody: JSON.stringify({ content: "生成失敗" }),
          reportContent: "",
        },
      },
    ];
  }
  return [
    {
      json: {
        requestBody: JSON.stringify({ content: reportContent }),
        reportContent,
      },
    },
  ];
}
