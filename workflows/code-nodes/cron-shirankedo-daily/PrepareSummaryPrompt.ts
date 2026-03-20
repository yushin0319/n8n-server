import { buildGeminiRequest } from "../_shared/gemini";
import { sanitizeForPrompt } from "../_shared/sanitizeForPrompt";

/** 選定済み記事の型 */
interface SelectedItem {
  title: string;
  fulltext?: string;
  impact?: number;
}

export default function (): CodeNodeReturn {
  const data = $input.first().json;
  const items = (data.items || []) as SelectedItem[];

  const itemsText = items
    .map(
      (a, i) =>
        `=== 記事${i + 1}: ${sanitizeForPrompt(a.title, 200)} (impact: ${a.impact}) ===\n${sanitizeForPrompt(a.fulltext || "(本文なし)", 2000)}`,
    )
    .join("\n\n");

  const prompt = `以下の${items.length}件のテック記事それぞれに対して、4つの情報を生成してください。

## 生成ルール
1. **tags**: 記事のカテゴリタグ。以下の固定リストから1-2個選択:
   ["AI", "セキュリティ", "フロントエンド", "インフラ", "OSS", "言語・ランタイム", "データ", "キャリア"]

2. **title_ja**: 日本語タイトル
   - 元タイトルが英語の場合: 自然な日本語に翻訳（直訳NG、意味が伝わる訳に）
   - 元タイトルが日本語の場合: そのまま返す

3. **summary**: 記事の要約（100〜150字、普通の日本語）
   - タイトルのコピーは禁止。本文を読んで内容を要約する
   - 「何が起きたか」「なぜ重要か」を含める
   - 検索で引っかかるようにキーワードを含める

4. **comment**: ギャル解説（100〜200字）
   ## 口調ルール
   「ギャルっぽい記号を貼り付けた文章」ではなく「ギャルが実際に喋りそうな文章」を書け。
   - 一人称「うち」。語尾「〜じゃん」「〜っしょ」「〜くない？」「〜じゃね？」「〜だし」
   - 強調「マジで」「ガチで」「超」「鬼」。感嘆「やば」「えぐ」「つよ」（体言止め）
   - テンションに緩急をつけろ。常時MAXはウソくさい。重い話は静かにしんどがれ
   - 絵文字は0〜1個。使わなくていい。効かせる時だけ
   - 「おけまる」「わかりみが深い」「あーし」は古い。使うな
   - 同じ語彙の連打禁止。「マジ？」「ヤバすぎ！」を毎回使うな
   - 1文目の入り方を毎回変えろ。同じパターンで始めるな
   - 比喩は「事実だけでは構図が伝わりにくい時」だけ使え。無理に入れるな
   - 禁止: 「〜だわ」「あたし」、敬語

## 記事
${itemsText}

## 出力形式（JSON配列）
[{"article_index":1,"tags":["AI"],"title_ja":"日本語タイトル","summary":"100〜150字の要約","comment":"ギャル解説テキスト"}]
JSONのみ出力してください。`;

  const geminiBody = buildGeminiRequest({ prompt, temperature: 0.7 });

  return [{ json: { geminiBody, items } }];
}
