import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const trendText: string = parseGeminiText(resp, "生成失敗");
  // 前ノードのプロンプト情報を引き継ぐ
  const prev = $("HasSummariesForComments").first().json;
  return [
    {
      json: {
        trendComment: trendText,
        aiApiPrompt: prev.aiApiPrompt,
        aiSubPrompt: prev.aiSubPrompt,
      },
    },
  ];
}
