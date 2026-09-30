import {
  parseXaiIndex,
  XAI_GUIDE_LIMIT,
  XAI_INDEX_URL,
} from "./_shared/deprecations";
import { fetchFailure, pageBody } from "./_shared/pageBody";

/**
 * xAI の llms.txt から移行ガイド（.md）の URL を拾い、2 回目の取得対象にする（最大 XAI_GUIDE_LIMIT 件）。
 * llms.txt が取れない・ガイドが見つからない・解析で例外が出た場合も 1 件は出力する（後続ノードを止めないため）。
 * その場合は llms.txt を再取得するだけの項目にし、indexError に理由を入れて ParseDeprecations で警告する
 */
export function buildXaiGuideRequests(pages: IDataObject[]): IDataObject[] {
  const fallback = (reason: string) => [
    { vendor: "xai", url: XAI_INDEX_URL, indexError: reason },
  ];
  const index = pages.find((p) => p.vendor === "xai-index");
  if (!index) return fallback("llms.txt の取得結果がありません");
  const failure = fetchFailure(index);
  if (failure) return fallback(`llms.txt: ${failure}`);
  let urls: string[];
  try {
    urls = parseXaiIndex(pageBody(index) ?? "");
  } catch (e) {
    return fallback(`llms.txt の解析で例外: ${String(e).substring(0, 100)}`);
  }
  if (urls.length === 0)
    return fallback("llms.txt に移行ガイドのリンクがありません");
  const requests: IDataObject[] = urls
    .slice(0, XAI_GUIDE_LIMIT)
    .map((url) => ({ vendor: "xai", url }));
  if (urls.length > XAI_GUIDE_LIMIT) {
    // 上限超過は取れた分で続行し、警告だけ出す（ParseDeprecations が truncated を拾う）
    requests[0].truncated = `移行ガイド ${urls.length} 件のうち先頭 ${XAI_GUIDE_LIMIT} 件だけ取得`;
  }
  return requests;
}

export default function (): CodeNodeReturn {
  const pages = $input.all().map((i) => i.json);
  return buildXaiGuideRequests(pages).map((json) => ({ json }));
}
