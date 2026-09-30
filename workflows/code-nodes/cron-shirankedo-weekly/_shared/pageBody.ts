/**
 * HTTP Request ノード（fullResponse + responseFormat: text）の出力から本文を取り出す。
 *
 * n8n 2.23.4 の HttpRequestV3 は本文を `options.response.response.outputPropertyName`
 * （既定値 "data"）のキーに入れ、statusCode / headers / statusMessage を並べる。
 * WF では outputPropertyName を "body" に設定しているが、既定値のままでも読めるよう両方を見る。
 * 通信エラーで continueRegularOutput になった場合は { error } だけが入り、本文は無い
 */
export function pageBody(item: IDataObject): string | undefined {
  if (typeof item.body === "string") return item.body;
  if (typeof item.data === "string") return item.data;
  return undefined;
}

/** 取得失敗の理由。成功（200 かつ本文あり）なら null */
export function fetchFailure(item: IDataObject): string | null {
  if (item.error !== undefined) {
    const err = item.error as IDataObject;
    const code = err?.httpCode ?? err?.statusCode ?? err?.status;
    const msg = typeof err?.message === "string" ? err.message : "";
    return `HTTP ${code ?? "error"}${msg ? ` ${msg.substring(0, 100)}` : ""}`;
  }
  if (item.statusCode !== 200) return `HTTP ${item.statusCode ?? "error"}`;
  if (pageBody(item) === undefined) return "本文がありません";
  return null;
}
