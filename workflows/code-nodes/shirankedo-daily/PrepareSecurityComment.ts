import { buildGeminiRequest } from "../_shared/gemini";

/** 脆弱性の型（MergeVulnPaths経由） */
interface VulnEntry {
  cve_id: string;
  title: string;
  cvss_score?: number;
}

/** リリースの型（MergeReleasePaths経由） */
interface ReleaseEntry {
  repo: string;
  tag: string;
  type: string;
}

export default function (): CodeNodeReturn {
  // B(脆弱性)とC(リリース)の結果からセキュリティ日次コメントを生成
  let vulns: VulnEntry[] = [];
  let releases: ReleaseEntry[] = [];
  try {
    vulns =
      ($("MergeVulnPaths").first().json.vulnerabilities as VulnEntry[]) || [];
  } catch {
    /* 脆弱性パスが実行されなかった場合 */
  }
  try {
    releases =
      ($("MergeReleasePaths").first().json.releases as ReleaseEntry[]) || [];
  } catch {
    /* リリースパスが実行されなかった場合 */
  }

  const vulnText =
    vulns.length > 0
      ? vulns
          .map(
            (v) =>
              `- ${v.cve_id}: ${v.title} (CVSS: ${v.cvss_score ?? "N/A"})`,
          )
          .join("\n")
      : "（本日のCRITICAL脆弱性はなし）";

  const relText =
    releases.length > 0
      ? releases.map((r) => `- ${r.repo} ${r.tag} (${r.type})`).join("\n")
      : "（本日のメジャー/マイナーリリースはなし）";

  const prompt = `あなたはギャルのセキュリティアナリストです。今日のセキュリティ状況をまとめてコメントしてください。

## 今日の脆弱性（${vulns.length}件）
${vulnText}

## 今日のリリース（${releases.length}件）
${relText}

## コメントルール
- 200字以内
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
