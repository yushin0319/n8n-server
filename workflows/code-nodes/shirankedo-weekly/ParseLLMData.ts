/** フィルタ済みモデル */
interface FilteredModel {
  name: string;
  provider: string;
  score: number;
  inputPrice: number;
  outputPrice: number;
}

/** スキップ判定: 不要モデルを除外 */
function shouldSkip(name: string): boolean {
  const skipExact = [
    "Distill",
    "Mixtral",
    "Ministral",
    "Pixtral",
    "Devstral",
    "gpt-oss",
    "Gemma",
  ];
  if (skipExact.some((x) => name.includes(x))) return true;
  if (["GPT-3.5", "Llama 2 ", "Mistral 7B"].some((x) => name.includes(x)))
    return true;
  if (name === "o1-preview" || name === "o1-pro") return true;
  if (name.includes("Llama")) {
    if (
      !["Llama 4 Maverick", "Llama 4 Scout", "Llama 3.3"].some((a) =>
        name.includes(a),
      )
    )
      return true;
  }
  if (["Mistral Small", "Mistral Medium", "Mistral Large"].includes(name))
    return true;
  if (["Claude 4 Opus", "Claude 4.1 Opus"].some((x) => name.includes(x)))
    return true;
  if (name.includes("Magistral Small")) return true;
  if (
    [
      "Qwen3 VL",
      "Qwen3.5 VL",
      "Coder",
      "Omni",
      "QwQ",
      "Qwen2",
      "Qwen Chat",
    ].some((x) => name.includes(x))
  )
    return true;
  if (/Qwen3\.?5?\s+[0-4](?:\.\d+)?B\b/.test(name)) return true;
  if (/^Qwen3 \d+B/.test(name) && !name.includes("Qwen3 Max")) return true;
  if (name.includes("Qwen3 Next")) return true;
  if (name.includes("GLM") && (/V /.test(name) || /V\(/.test(name)))
    return true;
  if (name.includes("GLM-4.5-Air")) return true;
  if (name.includes("Nova") && name.includes("Omni")) return true;
  return false;
}

/** ファミリーキー: 同一モデルファミリーのデデュプ用正規化名 */
function familyKey(n: string): string {
  let c = n.replace(/\s*\(.*?\)/g, "");
  c = c.replace(/\s*-\s*\d{4}-\d{2}-\d{2}$/, "");
  c = c.replace(/\s*(Preview|Exp|Terminus)\b/g, "");
  c = c.replace(/\s+\d{4}$/, "");
  c = c.replace(
    /(Mistral (?:Small|Medium|Large|Magistral \w+))\s+[\d.]+/g,
    "$1",
  );
  if (/^GPT-5(\.\d+)?$/.test(c)) c = "GPT-5";
  c = c.replace(/(DeepSeek V3)[\d.]*/g, "$1");
  c = c.replace(/(DeepSeek R1)[\s\d]*/g, "$1");
  c = c.replace(/Grok [\d.]+ Fast/g, "Grok Fast");
  c = c.replace(/Gemini 3\.\d+ Pro/g, "Gemini 3 Pro");
  c = c.replace(/Gemini (\d+)\.(\d+) (Flash-Lite|Flash)$/g, "Gemini $1 $3");
  c = c.replace(/(Qwen3\.5 \d+B(?: A\d+B)?)\s+\d{4}/g, "$1");
  c = c.replace(/(Qwen3 \d+B(?: A\d+B)?)\s+\d{4}/g, "$1");
  c = c.replace(/Qwen3 Max.*/g, "Qwen3 Max");
  c = c.replace(/Kimi K2\.5.*/g, "Kimi K2.5");
  c = c.replace(/Kimi K2(?!\.5).*/g, "Kimi K2");
  c = c.replace(/MiniMax-M2\.\d+/g, "MiniMax-M2");
  c = c.replace(/MiniMax M2/g, "MiniMax-M2");
  c = c.replace(/(GLM-\d+(?:\.\d+)?)\b.*/g, "$1");
  c = c.replace(/(MiMo-V2-Flash).*/g, "$1");
  c = c.replace(/(Nova \d+\.\d+ (?:Pro|Lite|Omni)).*/g, "$1");
  c = c.replace(/(Nova Premier).*/g, "$1");
  return c.trim();
}

export type { FilteredModel };
export { familyKey, shouldSkip };

export default function (): CodeNodeReturn {
  // AA APIデータからモデルをフィルタ・デデュプ
  // MergeLLMInputs(combineAll)経由で$inputから取得（Mock経由でも動作する）
  const items = $input.all();
  const aaResp = items[0]?.json ?? {};
  const rateResp = items[0]?.json ?? {};
  const aaData = (aaResp.data || []) as IDataObject[];
  const rates = (rateResp?.rates || {}) as IDataObject;
  const jpyRate = (rates.JPY as number) || 150;
  const eurRate = (rates.EUR as number) || 1;

  // Provider mapping
  const PROVIDERS: Record<string, string> = {
    Anthropic: "Anthropic",
    OpenAI: "OpenAI",
    Google: "Google",
    DeepSeek: "DeepSeek",
    xAI: "xAI",
    Meta: "Meta",
    Mistral: "Mistral",
    Alibaba: "Alibaba",
    Kimi: "Moonshot",
    MiniMax: "MiniMax",
    "Z AI": "Zhipu AI",
    Xiaomi: "Xiaomi",
    Amazon: "Amazon",
    Microsoft: "Microsoft",
  };

  // Step 1: Basic filter
  const filtered: FilteredModel[] = [];
  for (const m of aaData) {
    const name = (m.name as string) || "";
    const creatorName =
      ((m.model_creator as IDataObject)?.name as string) || "";
    let provider: string | null = null;
    for (const [pname, display] of Object.entries(PROVIDERS)) {
      if (creatorName.toLowerCase().includes(pname.toLowerCase())) {
        provider = display;
        break;
      }
    }
    if (!provider) continue;
    const pricing = (m.pricing || {}) as IDataObject;
    const inp = pricing.price_1m_input_tokens as number | undefined;
    const out = pricing.price_1m_output_tokens as number | undefined;
    if (inp == null || out == null || (inp === 0 && out === 0)) continue;
    if (name.toLowerCase().includes("codex")) continue;
    const intel = (m.evaluations as IDataObject)
      ?.artificial_analysis_intelligence_index as number | undefined;
    if (intel == null) continue;
    filtered.push({
      name,
      provider,
      score: intel,
      inputPrice: inp,
      outputPrice: out,
    });
  }

  // Step 2 + 3: Skip + family dedup
  const families: Record<string, FilteredModel> = {};
  for (const m of filtered) {
    if (shouldSkip(m.name)) continue;
    const fk = familyKey(m.name);
    if (!families[fk] || m.score > families[fk].score) {
      families[fk] = m;
    }
  }

  // Step 4: Sort + cut below 15
  const models = Object.values(families)
    .filter((m) => m.score >= 15)
    .sort((a, b) => b.score - a.score)
    .map((m) => {
      const cleanName = m.name.replace(/\s*\(.*?\)/g, "").trim();
      return {
        modelName: cleanName,
        provider: m.provider,
        score: m.score,
        inputPrice: m.inputPrice,
        outputPrice: m.outputPrice,
        currency: "USD",
      };
    });

  // 出力: [0] LLMモデル配列, [1] 為替レート
  return [
    {
      json: {
        requestBody: JSON.stringify(models),
        count: models.length,
        type: "llm-models",
      },
    },
    {
      json: {
        requestBody: JSON.stringify({
          jpyPerUsd: jpyRate,
          jpyPerEur: jpyRate / eurRate,
          updatedAt: new Date().toISOString(),
        }),
        type: "exchange-rate",
      },
    },
  ];
}
