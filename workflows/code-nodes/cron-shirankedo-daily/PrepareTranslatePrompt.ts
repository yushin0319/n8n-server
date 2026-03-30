export default function (): CodeNodeReturn {
  // バッチごとにGemini翻訳プロンプトを構築
  const data = $input.first().json;
  const batches = (data.batches || []) as IDataObject[][];
  const results: INodeExecutionData[] = [];

  for (const batch of batches) {
    const lines = batch
      .map(
        (r: IDataObject, i: number) =>
          `${i + 1}. ${r.repo}: ${r.description || "No description"}`,
      )
      .join("\n");

    const prompt = `以下のGitHubリポジトリについて、display_nameと説明文(description)を生成してください。

  ## display_nameルール
  - リポジトリの公式名称（README/サイトの表記）に合わせる
  - ハイフン区切りはスペース区切り+先頭大文字に（例: open-webui → Open WebUI）
  - 公式略称があればそれを使う（例: vscode → VS Code）

  ## descriptionルール
  - 10〜20文字の日本語
  - 体言止め（「〜ツール」「〜フレームワーク」「〜ライブラリ」等）
  - そのリポが何であるかを一言で表す。機能列挙はしない
  - 良い例: ローカルLLMランタイム、AI対応ワークフロー自動化、手書き風ホワイトボード
  - 悪い例: 監視ツール（短すぎ・曖昧）、OpenAIの代替となるセルフホスト型ローカルLLM推論エンジン（長すぎ）

  各行を「番号. display_name | description」の形式で返してください。

  ${lines}`;

    results.push({
      json: { prompt, repos: batch, batchIndex: results.length },
    });
  }
  return results;
}
