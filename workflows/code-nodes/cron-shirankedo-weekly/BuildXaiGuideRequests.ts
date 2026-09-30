import { parseXaiIndex, XAI_INDEX_URL } from "./deprecations";

/**
 * xAI の llms.txt から移行ガイド（.md）の URL を拾い、2 回目の取得対象にする。
 * llms.txt が取れない・ガイドが見つからない場合も 1 件は出力する（後続ノードを止めないため）。
 * その場合は llms.txt を再取得するだけの項目にし、indexError に理由を入れて ParseDeprecations で警告する
 */
export function buildXaiGuideRequests(pages: IDataObject[]): IDataObject[] {
  const index = pages.find((p) => p.vendor === "xai-index");
  let reason: string;
  if (!index) {
    reason = "llms.txt の取得結果がありません";
  } else if (index.statusCode !== 200 || typeof index.body !== "string") {
    reason = `llms.txt: HTTP ${index.statusCode ?? "error"}`;
  } else {
    const urls = parseXaiIndex(index.body);
    if (urls.length > 0) return urls.map((url) => ({ vendor: "xai", url }));
    reason = "llms.txt に移行ガイドのリンクがありません";
  }
  return [{ vendor: "xai", url: XAI_INDEX_URL, indexError: reason }];
}

export default function (): CodeNodeReturn {
  const pages = $input.all().map((i) => i.json);
  return buildXaiGuideRequests(pages).map((json) => ({ json }));
}
