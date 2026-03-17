export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const aiSubText: string =
    (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "生成失敗";
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
