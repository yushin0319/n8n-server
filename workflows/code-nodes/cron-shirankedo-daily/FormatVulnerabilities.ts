import { parseGeminiJson } from "../_shared/gemini";

/** Gemini翻訳結果の型 */
interface TitleEntry {
  index: number;
  title: string;
}

/** NVD脆弱性データの型 */
interface Vulnerability {
  cveId: string;
  description: string;
  cvssScore: number | null;
  publishedAt: string;
}

export default function (): CodeNodeReturn {
  // Gemini翻訳結果とCVEデータをマージ
  const data = $("PrepareNVDTranslation").first().json;
  const vulns = data.vulnerabilities as Vulnerability[];
  const geminiResponse = $input.first().json;

  let titles: TitleEntry[];
  try {
    titles = parseGeminiJson<TitleEntry[]>(geminiResponse);
  } catch {
    // Geminiパース失敗時: descriptionから短縮タイトルを生成
    titles = vulns.map((v, i) => ({
      index: i + 1,
      title: v.description.substring(0, 50),
    }));
  }

  const apiBody = vulns.map((v, i) => {
    const titleEntry = titles.find((t) => t.index === i + 1);
    return {
      cveId: v.cveId,
      title: titleEntry ? titleEntry.title : v.description.substring(0, 50),
      cvssScore: v.cvssScore,
      publishedAt: v.publishedAt,
    };
  });

  return [
    {
      json: {
        requestBody: JSON.stringify(apiBody),
        count: apiBody.length,
        vulnerabilities: apiBody,
      },
    },
  ];
}
