/**
 * PatchNotion（HTTP PATCH）の逐次実行結果を 1 件にまとめる。
 * onError:continueErrorOutput で失敗分は error ブランチに流れる想定のため、
 * ここでは main ブランチの成功件数と失敗件数の内訳を期待しない単純集計。
 */
export default function (): CodeNodeReturn {
  const items = $input.all();
  const webhookBody = $("Webhook").first()?.json?.body as
    | IDataObject
    | undefined;
  const isTest = webhookBody?.test === true;

  const patched = items.length;
  const samples = items.slice(0, 5).map((i) => ({
    pageId: i.json?.pageId,
    messageId: i.json?.messageId,
    subject: i.json?.subject,
  }));

  return [
    {
      json: {
        status: "ok",
        test: isTest,
        patched,
        samples,
      },
    },
  ];
}
