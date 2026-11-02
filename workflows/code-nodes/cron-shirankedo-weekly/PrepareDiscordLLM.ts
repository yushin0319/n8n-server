import { obsNotifyFromCron } from "../_shared/obsNotifyPayload";

export default function (): CodeNodeReturn {
  // MergePostResults (append) の出力: [0] LLM モデルの送信結果, [1] 為替レートの送信結果
  const [llm = {}, rate = {}] = $input.all().map((item) => item.json);
  const llmOk = llm.ok === true;
  const rateOk = rate.ok === true;

  if (llmOk && rateOk) {
    const count = (llm.inserted as number) || 0;
    const updated = (llm.updated as number) || 0;
    // shirankedo 側で今回の一覧に無いモデルを削除した件数
    const deleted = (llm.deleted as number) || 0;
    return [
      {
        json: obsNotifyFromCron({
          label: "LLM価格更新完了",
          isError: false,
          detail: `${count}件追加, ${updated}件更新, ${deleted}件削除`,
          service: "n8n",
          repo: "shirankedo",
        }),
      },
    ];
  }

  const failed: [string, typeof llm][] = [];
  if (!llmOk) failed.push(["LLM価格", llm]);
  if (!rateOk) failed.push(["為替レート", rate]);
  return [
    {
      json: obsNotifyFromCron({
        label: `${failed.map(([name]) => name).join("・")}更新失敗`,
        isError: true,
        detail: failed
          .map(([name, r]) => `${name}: ${JSON.stringify(r).substring(0, 200)}`)
          .join(" / "),
        service: "n8n",
        repo: "shirankedo",
        raw_payload: { llm, exchangeRate: rate },
      }),
    },
  ];
}
