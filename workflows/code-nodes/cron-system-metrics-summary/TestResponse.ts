export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "system-metrics-summary",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
