import { parseGeminiText } from "../_shared/gemini";

export default function (): CodeNodeReturn {
  const resp = $input.first().json;
  const trendText: string = parseGeminiText(resp, "生成失敗");
  return [{ json: { trendComment: trendText } }];
}
