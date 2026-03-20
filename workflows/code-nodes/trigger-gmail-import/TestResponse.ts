export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "gmail-to-notion",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
