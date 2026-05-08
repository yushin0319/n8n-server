export default function (): CodeNodeReturn {
  // トレンドランキングからトレンドコメント用プロンプトを構築
  const trendRanking = ($input.first()?.json.data || []) as IDataObject[];

  if (trendRanking.length === 0) {
    return [{ json: { hasSummaries: false } }];
  }

  const trendRankingText = trendRanking
    .map(
      (r: IDataObject, i: number) =>
        `${i + 1}. **${r.displayName}** (${r.repo}) — ★${r.stars?.toLocaleString()} (+${r.diff?.toLocaleString()})\n   ${r.description} [${r.language}]`,
    )
    .join("\n");

  const toneRules = `## 口調ルール
  「ギャルっぽい記号を貼り付けた文章」ではなく「ギャルが実際に喋りそうな文章」を書け。
  - 一人称「うち」。語尾「〜じゃん」「〜っしょ」「〜くない？」「〜じゃね？」「〜だし」
  - 強調「マジで」「ガチで」「超」「鬼」。感嘆「やば」「えぐ」「つよ」（体言止め）
  - テンションに緩急をつけろ。常時MAXはウソくさい。重い話は静かにしんどがれ
  - 絵文字は0〜1個。使わなくていい。効かせる時だけ
  - 「おけまる」「わかりみが深い」「あーし」は古い。使うな
  - 同じ語彙の連打禁止。「マジ？」「ヤバすぎ！」を毎回使うな
  - 1文目の入り方を毎回変えろ。同じパターンで始めるな
  - 「知らんけど」は毎回入れない。くどくなる`;

  const formatRules = `## フォーマット
  - 150〜300文字で書くこと。短すぎも長すぎもダメ
  - 「何が起きたか」だけでなく「それに対してどう感じるか」を必ず含めること
  - 事実の羅列は禁止。読んだ人が「ふーん」で終わるコメントは失敗
  - 最後まで書ききること。文の途中で終わるな`;

  const trendPrompt = `あなたはテック系トレンドページの総評コメントを書くライターです。

  ${toneRules}

  ${formatRules}

  ## このコメントの役割
  テック系トレンドページに表示される総評コメント。
  このページにはGitHubリポジトリが★週間増加数順に並んでいる。

  以下の「今週のトレンド TOP10」を主軸にコメントを書け。
  - TOP10のうち最低2〜3個のリポ名（displayName）を具体的に挙げろ
  - 「なぜ今伸びてるのか」「何がすごいのか」の視点で語れ
  - 業界全体の抽象論で逃げるな。ページを見てる人が「あ、これの話してる」とわかるように

  ## 今週のトレンド TOP10
  ${trendRankingText}`;

  return [
    {
      json: {
        hasSummaries: true,
        trendPrompt,
        aiApiPrompt: "",
        aiSubPrompt: "",
      },
    },
  ];
}
