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
 *
 * 2026-08-11 追記 (from の下限クランプ):
 * 上記の「失敗したら次回同範囲で再試行」は、失敗原因が「範囲が広すぎて OOM」
 * のとき自己増悪ループになる。実際 2026-08-05 18:00 UTC の成功を最後に
 * last_archive_at が固定され、8/6〜8/10 の 5 日連続で毎日 03:00 JST に
 * V8 heap limit (256MB) 到達 → コンテナ強制再起動を起こした。
 * 範囲が広がる → 取得件数が増える → OOM → checkpoint 未更新 → 翌日さらに広がる。
 *
 * 対策として from に下限 (to - MAX_WINDOW_HOURS) を設ける。正常時は前回 to から
 * 24h なのでクランプは発動しない。クランプが起きた場合は clamped/skipped_hours を
 * 出力し、下流でスキップ範囲を可視化できるようにする (穴が空いた事実を隠さない)。
 */
const MAX_WINDOW_HOURS = 26;

export default function (): CodeNodeReturn {
  const data = $getWorkflowStaticData("global");
  const lastAt = (data.last_archive_at as string | undefined) || "";
  const now = new Date();
  const to = now.toISOString();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const file_date = jstNow.toISOString().slice(0, 10);

  const fallbackFromMs = now.getTime() - 24 * 60 * 60 * 1000;
  const minFromMs = now.getTime() - MAX_WINDOW_HOURS * 60 * 60 * 1000;

  // last_archive_at が壊れている (パース不能) 場合も fallback に倒す
  const parsed = lastAt ? Date.parse(lastAt) : Number.NaN;
  let fromMs = Number.isFinite(parsed) ? parsed : fallbackFromMs;

  // checkpoint が古すぎるときのクランプ。窓を固定幅に切って OOM ループを断つ。
  let clamped = false;
  let skipped_hours = 0;
  if (fromMs < minFromMs) {
    skipped_hours = Math.round(((minFromMs - fromMs) / 3600000) * 10) / 10;
    fromMs = minFromMs;
    clamped = true;
  }

  return [
    {
      json: {
        from: new Date(fromMs).toISOString(),
        to,
        file_date,
        clamped,
        skipped_hours,
      },
    },
  ];
}
