export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "gmail-import-recovery",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
      },
    },
  ];
}
