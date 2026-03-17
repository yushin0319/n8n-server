/** 選定記事の型 */
interface SelectedArticle {
  url: string;
  title: string;
  source: string;
  impact: number;
  isPaper: number;
}

export default function (): CodeNodeReturn {
  // HTML本文から<p>タグ内容を抽出し、元データとマージして1件に集約
  const fetchResults = $input.all();
  const originals = $("ParseSelection").all();

  const combined: IDataObject[] = [];
  for (let i = 0; i < originals.length; i++) {
    const orig = originals[i].json as unknown as SelectedArticle;
    const fetched = fetchResults[i]?.json || {};
    let fulltext = "";
    const rawHtml = (fetched.data as string) || "";
    if (rawHtml && typeof rawHtml === "string") {
      const paragraphs = rawHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
      fulltext = paragraphs
        .map((p) => p.replace(/<[^>]+>/g, "").trim())
        .filter((t) => t.length > 20)
        .join("\n")
        .substring(0, 3000);
    }
    if (!fulltext) fulltext = "(本文取得失敗)";
    combined.push({
      url: orig.url,
      title: orig.title,
      source: orig.source,
      impact: orig.impact,
      isPaper: orig.isPaper,
      fulltext,
    });
  }
  return [{ json: { items: combined } }];
}
