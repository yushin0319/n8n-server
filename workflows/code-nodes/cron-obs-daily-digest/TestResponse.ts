/**
 * 最終応答。送信した / しなかったどちらの経路からも来るため、件数は集計ノードから取る。
 * スモークテストは status=ok と test=true を見る。
 */
export default function (): CodeNodeReturn {
  const summary = $("AggregateAndFormat").first().json;
  // n8n 2.44.4 では前段の Code ノードが立てた customData を実行中に読めないので、
  // CheckTestMode が受け取った webhook body を直接見る
  const body = $("CheckTestMode").first().json.body as IDataObject | undefined;
  const isTest = body?.test === true;
  return [
    {
      json: {
        status: "ok",
        workflow: "obs-daily-digest",
        test: isTest,
        sent: !isTest && summary.skip !== true,
        criticalCount: summary.criticalCount,
        warningCount: summary.warningCount,
        tradeCount: summary.tradeCount,
        timestamp: new Date().toISOString(),
      },
    },
  ];
}
