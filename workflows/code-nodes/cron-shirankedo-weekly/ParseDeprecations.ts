import {
  type DeprecationEntry,
  parseVendorPage,
  type Vendor,
} from "./_shared/deprecations";
import { fetchFailure, pageBody } from "./_shared/pageBody";

const VENDORS: Vendor[] = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "kimi",
  "xiaomi",
  "deepseek",
];

export interface DeprecationResult {
  deprecations: DeprecationEntry[];
  deprecationWarnings: string[];
}

/** 1 社分の解析。警告があれば返す（エントリは使わない） */
function collectVendor(
  vendor: Vendor,
  vendorPages: IDataObject[],
  warnings: string[],
): DeprecationEntry[] {
  const entries: DeprecationEntry[] = [];
  let fetched = 0;
  let markerFound = false;
  for (const p of vendorPages) {
    if (typeof p.indexError === "string") {
      warnings.push(`${vendor}: ${p.indexError}`);
      continue;
    }
    if (typeof p.truncated === "string")
      warnings.push(`${vendor}: ${p.truncated}`);
    const failure = fetchFailure(p);
    if (failure) {
      warnings.push(`${vendor}: ${failure} (${p.url})`);
      continue;
    }
    fetched++;
    const r = parseVendorPage(vendor, pageBody(p) ?? "");
    markerFound ||= r.markerFound;
    entries.push(...r.entries);
  }
  if (fetched === 0) {
    if (vendorPages.length === 0)
      warnings.push(`${vendor}: 取得結果がありません`);
    return [];
  }
  if (!markerFound) {
    warnings.push(`${vendor}: 廃止一覧の表・見出しが見つかりません`);
    return [];
  }
  if (!entries.some((e) => e.retireAt)) {
    warnings.push(`${vendor}: 日付付きの廃止エントリが 0 件です`);
    return [];
  }
  return entries;
}

/**
 * 取得した廃止一覧ページを解析する（純粋関数）。
 * 社ごとに fail-open: 取得失敗 / 構造が見つからない / 日付付きエントリ 0 件 / 解析中の例外なら、
 * その社のエントリは使わず（除外 0 件）警告だけ出す。例外で WF 全体（LLM 一覧・為替の投稿）を止めない。
 * 「0 件」は前回との比較ではなく常に異常とみなす。各社の一覧は過去の廃止も載せ続けるため、
 * 正常なら 1 件以上あるはずで、状態を持たなくても同じ判定になる
 */
export function collectDeprecations(pages: IDataObject[]): DeprecationResult {
  const deprecations: DeprecationEntry[] = [];
  const warnings: string[] = [];
  for (const vendor of VENDORS) {
    const vendorWarnings: string[] = [];
    try {
      const entries = collectVendor(
        vendor,
        pages.filter((p) => p.vendor === vendor),
        vendorWarnings,
      );
      deprecations.push(...entries);
      warnings.push(...vendorWarnings);
    } catch (e) {
      warnings.push(...vendorWarnings);
      warnings.push(`${vendor}: 解析で例外: ${String(e).substring(0, 100)}`);
    }
  }
  return { deprecations, deprecationWarnings: warnings };
}

export default function (): CodeNodeReturn {
  const pages = $input.all().map((i) => i.json);
  return [{ json: { ...collectDeprecations(pages) } }];
}
