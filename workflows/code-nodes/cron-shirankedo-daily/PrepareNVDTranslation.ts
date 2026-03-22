import { buildGeminiRequest } from "../_shared/gemini";
import { sanitizeForPrompt } from "../_shared/sanitizeForPrompt";

/** NVD脆弱性データの型 */
interface Vulnerability {
  cveId: string;
  description: string;
  cvssScore: number | null;
  publishedAt: string;
}

export default function (): CodeNodeReturn {
  // Geminiバッチ翻訳プロンプトを構築
  const data = $input.first().json;
  const vulns = (data.vulnerabilities || []) as Vulnerability[];
  if (vulns.length === 0) {
    return [{ json: { requestBody: "[]", count: 0, skip: true } }];
  }

  const vulnText = vulns
    .map(
      (v, i) =>
        `${i + 1}. [${v.cveId}] (CVSS: ${v.cvssScore ?? "N/A"}) ${sanitizeForPrompt(v.description, 300)}`,
    )
    .join("\n\n");

  const prompt = `以下のNVD脆弱性情報の英語説明を、簡潔な日本語タイトル（30～50字）に変換してください。
技術用語はカタカナまたは英語のまま残してください。

## 脆弱性一覧（${vulns.length}件）
${vulnText}

## 出力形式（JSON配列）
[{"index": 1, "title": "日本語タイトル"}]
JSONのみ出力してください。`;

  const geminiBody = buildGeminiRequest({
    prompt,
    temperature: 0.2,
    thinkingBudget: 0,
  });

  return [
    {
      json: {
        geminiBody,
        vulnerabilities: vulns,
        count: vulns.length,
        skip: false,
      },
    },
  ];
}
