/**
 * staticData.last_archive_at を読んで from/to/file_date を決定。
 *
 * - from: 前回完了時刻 (staticData.last_archive_at) or (now - 24h) fallback
 * - to:   今回実行開始時刻 (now)
 * - file_date: 実行日 YYYY-MM-DD JST
 *
 * チェックポイント方式: SaveCheckpoint で Drive 保存成功後にのみ staticData
 * 更新するので、途中失敗時は次回同範囲で再試行され穴が空かない。n8n 停止後の
 * 復旧時は from が 24h 超過去になり pagination で全件回収する。
 *
 * Notion #561: 旧設計は startedBefore=今朝0:00 JST + limit=250 1ページのみで
 * 1日 ~487件中 ~95件しか archive・DELETE できず DB 264MB に再肥大した。
 * 取得範囲をスライディング窓にし、HTTP Request 側の pagination で全件回収。
 */
export default function (): CodeNodeReturn {
  const data = $getWorkflowStaticData("global");
  const lastAt = (data.last_archive_at as string | undefined) || "";
  const now = new Date();
  const to = now.toISOString();
  const from =
    lastAt || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const file_date = jstNow.toISOString().slice(0, 10);

  return [
    {
      json: { from, to, file_date },
    },
  ];
}
