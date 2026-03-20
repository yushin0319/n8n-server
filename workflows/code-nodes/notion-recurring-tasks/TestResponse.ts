export default function (): CodeNodeReturn {
  // テストモード: スキップされたアクションのレスポンス
  const body = $input.first().json.body || {};
  return [
    {
      json: {
        action: body.action || "unknown",
        test: true,
        skipped: true,
        message: "Test mode: API call skipped",
      },
    },
  ];
}
