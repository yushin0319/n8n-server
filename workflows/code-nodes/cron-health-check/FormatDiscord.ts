import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

/**
 * CheckTargets の結果から、失敗した確認先だけ obs-notify の warning にする。
 * CheckTargets は onError: continueRegularOutput なので、入力 (BuildTargets) と同じ順で
 * 失敗した item が { error } になって届く。順番で確認先と突き合わせる。
 * 全部成功なら allOk の 1 item を返し、IfAllOk で通知を飛ばさずに TestResponse へ進める。
 */
export default function (): CodeNodeReturn {
  const targets = $("BuildTargets").all();
  const results = $input.all();
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const failures: INodeExecutionData[] = [];
  results.forEach((result, i) => {
    const error = result.json?.error;
    const target = targets[i]?.json;
    if (!error || !target) return;
    const message =
      typeof error === "string"
        ? error
        : String((error as IDataObject).message ?? JSON.stringify(error));
    failures.push({
      json: obsNotifyFromCron({
        label: `${target.name} DOWN`,
        isError: true,
        detail: `${now} に ${target.url} のヘルスチェックが失敗しました。(${message.slice(0, 200)})`,
        service: target.service as string,
        repo: target.repo as string,
        severity: "warning",
      }),
    });
  });

  return failures.length > 0 ? failures : [{ json: { allOk: true } }];
}
