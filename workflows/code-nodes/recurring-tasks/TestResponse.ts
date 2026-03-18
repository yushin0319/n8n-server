export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "recurring-tasks",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
