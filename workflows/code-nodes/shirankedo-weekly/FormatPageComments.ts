import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const aiSubText: string = parseGeminiText(resp, "生成失敗");
  const prev = $("FormatAIApiComment").first().json;

  const comments = [
    { type: "trend", content: prev.trendComment },
    { type: "ai_api", content: prev.aiApiComment },
    { type: "ai_sub", content: aiSubText },
  ];

  return [
    {
      json: {
        requestBody: JSON.stringify(comments),
        count: comments.length,
      },
    },
  ];
}
