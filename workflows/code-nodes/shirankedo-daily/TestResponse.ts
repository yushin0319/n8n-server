export default function (): CodeNodeReturn {
  return [{
    json: {
      status: "ok",
      workflow: "shirankedo-daily",
      test: true,
      timestamp: new Date().toISOString(),
      message: "スモークテスト正常終了",
    },
  }];
}
