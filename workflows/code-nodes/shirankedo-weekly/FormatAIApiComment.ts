export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const aiApiText: string =
    (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "生成失敗";
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
