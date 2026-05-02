/**
 * test mode で IfTestMode 経由でのみ呼ばれる。本番モード (Schedule) では実行されない。
 * PrepUpload など下流ノードは未実行なので $('PrepUpload') 参照は禁止。
 */
export default function (): CodeNodeReturn {
  return [
    {
      json: {
        status: "ok",
        workflow: "db-archive-execution",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了 (副作用なし)",
      },
    },
  ];
}
