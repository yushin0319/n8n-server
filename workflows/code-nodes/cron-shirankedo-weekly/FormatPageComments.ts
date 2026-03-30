export default function (): CodeNodeReturn {
  const trendData = $("FormatTrendComment").first().json;

  const comments = [{ type: "trend", content: trendData.trendComment }];

  return [
    {
      json: {
        requestBody: JSON.stringify(comments),
        count: comments.length,
      },
    },
  ];
}
