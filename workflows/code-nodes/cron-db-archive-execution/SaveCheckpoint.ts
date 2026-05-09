/**
 * Drive 保存成功後に staticData.last_archive_at = to を更新する。
 *
 * Drive upload より下流に置くため、Drive 失敗時はこのノードに到達せず
 * staticData は更新されない。次回 archive で同 from から再試行される (穴埋め保証)。
 *
 * Notion #561: 旧設計は DELETE 完走を前提に毎回新規範囲で動いていたが、
 * pagination 取りこぼし + DELETE 失敗時の穴埋め責務が不明瞭だった。
 * チェックポイント方式へ全面移行。
 */
export default function (): CodeNodeReturn {
  const range = $("PrepRange").first().json as IDataObject;
  const to = String(range?.to || "");
  if (to) {
    const data = $getWorkflowStaticData("global");
    data.last_archive_at = to;
  }
  return [{ json: { last_archive_at: to } }];
}
