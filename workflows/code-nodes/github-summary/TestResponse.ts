export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "github-summary",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
