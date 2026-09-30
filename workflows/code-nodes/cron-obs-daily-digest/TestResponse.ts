/**
 * 最終応答。送信した / しなかったどちらの経路からも来るため、件数は集計ノードから取る。
 * スモークテストは status=ok と test=true を見る。
 */
export default function (): CodeNodeReturn {
  const summary = $("AggregateAndFormat").first().json;
  const isTest = $execution.customData.get("isTest") === "true";
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
