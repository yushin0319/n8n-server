export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "health-check",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
