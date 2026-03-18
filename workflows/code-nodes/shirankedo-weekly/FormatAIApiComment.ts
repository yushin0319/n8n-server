import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const aiApiText: string = parseGeminiText(resp, "生成失敗");
  const prev = $("FormatTrendComment").first().json;
  return [
    {
      json: {
        trendComment: prev.trendComment,
        aiApiComment: aiApiText,
        aiSubPrompt: prev.aiSubPrompt,
      },
    },
  ];
}
