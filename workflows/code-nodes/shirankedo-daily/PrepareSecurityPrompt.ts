import { buildGeminiRequest } from "../_shared/gemini";
import { sanitizeForPrompt } from "../_shared/sanitizeForPrompt";

/** APIから取得する脆弱性の型 */
interface VulnEntry {
  cveId: string;
  title: string;
  cvssScore?: number | null;
  publishedAt: string;
}

/** APIから取得するリリースの型 */
interface ReleaseEntry {
  repo: string;
  tag: string;
  type: string;
  publishedAt: string;
}

/** APIから取得する週次サマリーの型 */
interface SummaryEntry {
  content: string;
  createdAt: string;
}

export default function (): CodeNodeReturn {
  // FetchSecurityTop の APIレスポンスから取得
  const response = $input.first().json;
  const data = response.data as {
    vulns: VulnEntry[];
    releases: ReleaseEntry[];
    weeklySummaries: SummaryEntry[];
  };

  const vulns = data?.vulns || [];
  const releases = data?.releases || [];
  const summaries = data?.weeklySummaries || [];

  const vulnText =
    vulns.length > 0
      ? vulns
          .map(
            (v) =>
              `- ${v.cveId}: ${sanitizeForPrompt(v.title, 200)} (CVSS: ${v.cvssScore ?? "N/A"})`,
          )
          .join("\n")
      : "（本日のCRITICAL脆弱性はなし）";

  const relText =
    releases.length > 0
      ? releases
          .map(
            (r) =>
              `- ${sanitizeForPrompt(r.repo, 100)} ${sanitizeForPrompt(r.tag, 50)} (${sanitizeForPrompt(r.type, 20)})`,
          )
          .join("\n")
      : "（本日のメジャー/マイナーリリースはなし）";

  const summaryText =
    summaries.length > 0
      ? summaries
          .map((s) => `- ${sanitizeForPrompt(s.content, 300)}`)
          .join("\n")
      : "（週次レポートなし）";

  const prompt = `あなたはギャルのセキュリティアナリストです。今日のセキュリティ状況をまとめてコメントしてください。

## 今日の脆弱性 Top5（重要度順、${vulns.length}件）
${vulnText}

## 今日のリリース Top5（注目度順、${releases.length}件）
${relText}

## 直近の週次レポート（${summaries.length}件）
${summaryText}

## コメントルール
- 200字以内
- 脆弱性・リリースの最新動向を踏まえ、週次レポートとの連続性を意識してコメント
## 口調ルール
「ギャルっぽい記号を貼り付けた文章」ではなく「ギャルが実際に喋りそうな文章」を書け。
- 一人称「うち」。語尾「〜じゃん」「〜っしょ」「〜くない？」「〜じゃね？」「〜だし」
- 強調「マジで」「ガチで」「超」「鬼」。感嘆「やば」「えぐ」「つよ」（体言止め）
- テンションに緩急をつけろ。常時MAXはウソくさい。重い話は静かにしんどがれ
- 絵文字は0〜1個。使わなくていい。効かせる時だけ
- 「おけまる」「わかりみが深い」「あーし」は古い。使うな
- 同じ語彙の連打禁止。「マジ？」「ヤバすぎ！」を毎回使うな
- 禁止: 「〜だわ」「あたし」、敬語
- 脆弱性が多い日は注意喚起、リリースが目立つ日はアプデ推奨
- 何もない日は「今日は平和っしょ」的なコメント

## 出力形式（JSON）
{"comment": "コメント本文", "vuln_ids": ["CVE-2026-XXXXX"], "release_ids": []}
vuln_idsは言及したCVE-IDのリスト、release_idsは空配列。
JSONのみ出力してください。`;

  const geminiBody = buildGeminiRequest({ prompt, temperature: 0.7 });

  return [
    {
      json: {
        geminiBody,
        vulnCount: vulns.length,
        releaseCount: releases.length,
      },
    },
  ];
}
