import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  // Gemini結果を解析してstaticDataに蓄積（stars含む）
  // フォーマット: 番号. display_name | description
  const staticData = $getWorkflowStaticData("global");
  // 初回バッチで明示クリア（前回失敗時のゴミデータ防止）
  if (!staticData._translationsInitialized) {
    staticData.translations = [];
    staticData._translationsInitialized = true;
  }

  const resp = $input.first().json;
  const text: string = parseGeminiText(resp);
  const repos = ($("SplitTranslateBatches").first().json.repos ||
    []) as IDataObject[];

  const lines = text.split("\n").filter((l: string) => /^\d+\./.test(l.trim()));
  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    const line = lines[i] || "";
    const lineContent = line.replace(/^\d+\.\s*/, "").trim();
    // 「display_name | description」形式をパース
    const parts = lineContent.split("|").map((s: string) => s.trim());
    const displayName =
      parts.length >= 2
        ? parts[0]
        : (r.name as string) ||
          (r.repo as string).split("/")[1] ||
          (r.repo as string);
    const desc =
      parts.length >= 2 ? parts[1] : lineContent || (r.description as string);
    (staticData.translations as IDataObject[]).push({
      repo: r.repo,
      displayName,
      description: desc,
      language: r.language,
      stars: (r.stars as number) || 0,
    });
  }
  return $input.all();
}
