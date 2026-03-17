export default function (): CodeNodeReturn {
  // 直近7日の記事からGemini週次レポート用プロンプトを構築
  const articles = ($input.first().json.data || []) as IDataObject[];
  if (!articles.length) {
    return [{ json: { prompt: "", hasArticles: false, count: 0 } }];
  }

  const articleList = articles
    .map(
      (a: IDataObject, i: number) =>
        `${i + 1}. [${a.source}] ${a.title}\n   要約: ${a.summary}\n   タグ: ${a.tags}`,
    )
    .join("\n\n");

  const prompt = `以下の今週の記事一覧を分析し、週次サマリーを作成せよ。
  このサマリーはページコメント生成AIへの入力として使われる内部資料である。

  ## 出力フォーマット
  - 箇条書きで簡潔に（装飾・挨拶・口調の工夫は不要）
  - 今週の主要トピックを3〜5個に分類し、各トピックに関連記事を紐づける
  - 各トピックは「何が起きたか」「なぜ重要か」を1〜2文で記述
  - AI/LLM関連、セキュリティ関連、開発ツール関連の話題は必ず拾うこと

  ## 今週の記事（${articles.length}件）
  ${articleList}`;

  return [{ json: { prompt, hasArticles: true, count: articles.length } }];
}
