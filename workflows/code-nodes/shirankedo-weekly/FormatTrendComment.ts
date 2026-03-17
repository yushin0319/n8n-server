export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const trendText: string =
    (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "生成失敗";
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
