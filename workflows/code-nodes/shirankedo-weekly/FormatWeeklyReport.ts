export default function (): CodeNodeReturn {
  // Geminiレスポンスからレポートテキストを抽出
  const resp = $input.first().json;
  const reportContent: string =
    (resp as any).candidates?.[0]?.content?.parts?.[0]?.text || "";
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
