import { parseGeminiJson } from "../_shared/gemini";

/** セキュリティ日次コメントの型 */
interface SecurityComment {
  comment: string;
  vuln_ids: string[];
  release_ids: string[];
}

export default function (): CodeNodeReturn {
  const geminiResponse = $input.first().json;
  const result = parseGeminiJson<SecurityComment>(geminiResponse);

  const apiBody = {
    comment: result.comment || "",
    vuln_ids: result.vuln_ids || [],
    release_ids: result.release_ids || [],
  };
  return [
    {
      json: {
        requestBody: JSON.stringify(apiBody),
        comment: apiBody.comment,
      },
    },
  ];
}
