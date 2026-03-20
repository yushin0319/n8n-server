import { stripHtmlTags } from "../_shared/stripHtmlTags";

export default function (): CodeNodeReturn {
  // arXiv Atom XML をパースして [{title, url, description, source}] に変換
  const raw = ($input.first().json.data as string) || "";
  const entries: INodeExecutionData[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(raw)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<id>([\s\S]*?)<\/id>/);
    const summaryMatch = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const title = (titleMatch ? titleMatch[1] : "").replace(/\s+/g, " ").trim();
    const url = (linkMatch ? linkMatch[1] : "").trim();
    const desc = stripHtmlTags(summaryMatch ? summaryMatch[1] : "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);
    if (title && url) {
      entries.push({
        json: { title, url, description: desc, source: "arxiv" },
      });
    }
    if (entries.length >= 30) break;
  }
  if (entries.length === 0) {
    return [
      {
        json: {
          title: "arXiv empty",
          url: "",
          description: "",
          source: "arxiv",
        },
      },
    ];
  }
  return entries;
}
