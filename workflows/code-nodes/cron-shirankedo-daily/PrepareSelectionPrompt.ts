import { buildGeminiRequest } from "../_shared/gemini";
import { sanitizeForPrompt } from "../_shared/sanitizeForPrompt";

/** 記事/論文の候補型 */
interface ArticleCandidate {
  title: string;
  url: string;
  description?: string;
  source: string;
}

export default function (): CodeNodeReturn {
  const data = $input.first().json;
  const articles = (data.articles || []) as ArticleCandidate[];
  const papers = (data.papers || []) as ArticleCandidate[];

  const articleLines = articles
    .map(
      (a, i) =>
        `${i + 1}. [${sanitizeForPrompt(a.source, 50)}] ${sanitizeForPrompt(a.title, 200)}${a.description ? ` - ${sanitizeForPrompt(a.description, 100)}` : ""}`,
    )
    .join("\n");

  const paperLines = papers
    .map(
      (p, i) =>
        `${i + 1}. ${sanitizeForPrompt(p.title, 200)}${p.description ? ` - ${sanitizeForPrompt(p.description, 100)}` : ""}`,
    )
    .join("\n");

  const prompt = `あなたはテック系キュレーターです。以下の記事候補から、今日のトップ6件と注目論文1件を選んでください。

## 選定ルール

### Step 1: 重複統合
同じトピックの記事が複数ソースにある場合、1つに統合してください。

### Step 2: テーマ別クラスタリング
記事を内容でクラスタ分けしてください。偏りがある場合はそれがトレンドの信号です。

### Step 3: 2軸で選定
- 軸1（テーマ）: 最低5つの異なるテーマから選ぶ
- 軸2（読者への作用）: 以下の4種から最低3種を含める
  - 「すぐ動く」: 脆弱性、破壊的変更、重要リリース（1-2件）
  - 「知見が増える」: やってみた、実践記、チュートリアル（1-2件）
  - 「視点が変わる」: 議論提起、意外な事実、逆張り（1-2件）
  - 「触りたくなる」: 新ツール、ゲーム、デモ（1-2件）

### インパクトスコア基準
- 10: 業界全体が動く（主要FWのRCE、GPT-5リリース）
- 8-9: 多くの開発者に影響
- 6-7: 対応必要 or 注目イベント
- 4-5: 特定分野の人に重要
- 1-3: 面白いが行動不要

## 記事候補（${articles.length}件）
${articleLines}

## 論文候補（${papers.length}件）
${paperLines}

## 出力形式（JSON）
{"clusters":[{"theme":"テーマ名","count":1}],"articles":[{"index":1,"title":"タイトル","source":"ソース","impact":5,"effect":"すぐ動く","reason":"選定理由"}],"paper":{"index":1,"title":"タイトル","impact":5,"reason":"選定理由"}}
JSONのみ出力してください。`;

  const geminiBody = buildGeminiRequest({
    prompt,
    temperature: 0.3,
    thinkingBudget: 0,
  });

  return [{ json: { geminiBody, articles, papers } }];
}
