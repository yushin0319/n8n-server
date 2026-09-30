/**
 * LLM ベンダー公式の廃止（deprecation / retirement）一覧の取得元・解析・照合。
 *
 * 方針（2026-09-30 決定）:
 * - ベンダー公式の一覧に載り、停止日を過ぎたモデルだけを除外する。推測では除外しない
 * - 一覧が取れない・読めない社は、その社の除外を 0 件として扱う（fail-open）
 * - 日付を読めないエントリは除外しない
 */

/** 廃止一覧を持つベンダー（Alibaba は告知が JS 描画・画像のため対象外） */
export type Vendor =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "kimi"
  | "xiaomi"
  | "deepseek";

/** 1 回目の取得対象。xAI は llms.txt から移行ガイドの URL を拾い、2 回目で取得する */
export type SourceKey = Vendor | "xai-index";

export interface DeprecationSource {
  vendor: SourceKey;
  url: string;
}

export const XAI_INDEX_URL = "https://docs.x.ai/llms.txt";

export const DEPRECATION_SOURCES: DeprecationSource[] = [
  {
    vendor: "openai",
    url: "https://developers.openai.com/api/docs/deprecations.md",
  },
  {
    vendor: "anthropic",
    url: "https://platform.claude.com/docs/en/about-claude/model-deprecations.md",
  },
  {
    vendor: "google",
    url: "https://ai.google.dev/gemini-api/docs/deprecations.md.txt",
  },
  { vendor: "xai-index", url: XAI_INDEX_URL },
  { vendor: "kimi", url: "https://platform.kimi.ai/docs/models.md" },
  {
    vendor: "xiaomi",
    url: "https://platform.xiaomimimo.com/docs/en-US/updates/deprecate",
  },
  { vendor: "deepseek", url: "https://api-docs.deepseek.com/updates" },
];

/** shirankedo の provider 表示名 → ベンダー */
export const PROVIDER_VENDOR: Record<string, Vendor> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  xAI: "xai",
  Moonshot: "kimi",
  Xiaomi: "xiaomi",
  DeepSeek: "deepseek",
};

/** 廃止エントリ。retireAt は停止時刻（UTC ISO）。読めなければ null */
export interface DeprecationEntry {
  vendor: Vendor;
  id: string;
  retireAt: string | null;
}

export interface ParseResult {
  entries: DeprecationEntry[];
  /** ページ構造（表の見出し等）が見つかったか */
  markerFound: boolean;
}

// jsCode に Unicode エスケープを残さないため、特殊文字は文字コードで作る
const ch = (code: number) => String.fromCharCode(code);
/** U+2010〜U+2015 のハイフン・ダッシュ類と U+2212（マイナス記号） */
const DASHES = new RegExp(`[${ch(0x2010)}-${ch(0x2015)}${ch(0x2212)}]`, "g");
/** U+200B（ゼロ幅スペース。DeepSeek の見出しに入っている） */
const ZERO_WIDTH_SPACE = new RegExp(ch(0x200b), "g");

// --- 日付 ---

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * 時刻のない日付 D の停止時刻。
 * タイムゾーンが書かれていないので、D が地球上のどこでも終わった時刻
 * （UTC-12 の D 24:00 = UTC の D+1 12:00）を停止時刻とみなす。早めに消すことはない。
 */
function endOfDayAnywhere(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0)).toISOString();
}

/**
 * 日付セル → 停止時刻。"October 23, 2026" / "Oct 1, 2026" / "**August 31, 2026**" / "2026-09-24"。
 * "Not sooner than ..." や "No shutdown date announced" など、それ以外は null
 */
export function parseMonthDate(text: string): string | null {
  // OpenAI は "2026‑03‑26" のように U+2011（改行しないハイフン）を使う行がある
  const t = text.replace(/\*/g, "").replace(DASHES, "-").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso)
    return endOfDayAnywhere(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (month === 0) return null;
  return endOfDayAnywhere(Number(m[3]), month, Number(m[2]));
}

/** 時差付きの現地時刻 → UTC ISO（offsetHours は UTC からの差。北京 +8） */
function localToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  offsetHours: number,
): string {
  return new Date(Date.UTC(y, mo - 1, d, h - offsetHours, mi, 0)).toISOString();
}

/** 停止時刻を過ぎたか。日付不明は過ぎていない扱い */
export function isRetired(entry: DeprecationEntry, now: Date): boolean {
  if (!entry.retireAt) return false;
  const t = Date.parse(entry.retireAt);
  return Number.isFinite(t) && t <= now.getTime();
}

// --- 共通ヘルパー ---

/**
 * HTML → 1 行のテキスト（解析用。出力を HTML として使うことはない）。
 * &amp; は最後に戻す（先に戻すと "&amp;lt;" が "<" まで二重に戻るため）
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(ZERO_WIDTH_SPACE, " ")
    .replace(/\s+/g, " ");
}

/** Markdown 表の 1 行をセルに分割（"\|" はセル内の文字として扱う） */
function splitRow(line: string): string[] {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/);
  return cells.map((c) => c.replace(/\\\|/g, "|").trim());
}

function backticked(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
}

const MODEL_ID = /^[a-z0-9][a-z0-9.\-_]*$/i;

/**
 * 同じ ID が複数の表に載る場合の統合。早い日付では消さないよう、
 * 日付未定（null: 延期・未発表）を最優先し、次に遅い日付を採用する
 */
function dedupe(entries: DeprecationEntry[]): DeprecationEntry[] {
  const seen = new Map<string, DeprecationEntry>();
  for (const e of entries) {
    const prev = seen.get(e.id);
    if (!prev) {
      seen.set(e.id, e);
    } else if (prev.retireAt !== null) {
      if (e.retireAt === null || e.retireAt > prev.retireAt) seen.set(e.id, e);
    }
  }
  return [...seen.values()];
}

// --- ベンダー別パーサー ---

/**
 * OpenAI / Anthropic / Google の Markdown 表。
 * 見出しで列を決める: モデル列 = "model" を含み replacement/substitute でない列、
 * 日付列 = "shutdown" か "retirement" を含む列、状態列 = "state"（あれば Deprecated/Retired の行のみ）
 */
export function parseMarkdownTables(md: string, vendor: Vendor): ParseResult {
  const lines = md.split(/\r?\n/);
  const entries: DeprecationEntry[] = [];
  let markerFound = false;
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const sep = lines[i + 1];
    if (!header.trim().startsWith("|") || !/^\s*\|[\s:|-]+\|\s*$/.test(sep))
      continue;
    const heads = splitRow(header).map((h) =>
      h.replace(/\*/g, "").toLowerCase(),
    );
    const modelCol = heads.findIndex(
      (h) => h.includes("model") && !/replacement|substitute/.test(h),
    );
    const dateCol = heads.findIndex((h) => /shutdown|retirement/.test(h));
    const stateCol = heads.findIndex((h) => h.includes("state"));
    if (modelCol < 0 || dateCol < 0) continue;
    markerFound = true;
    for (
      let j = i + 2;
      j < lines.length && lines[j].trim().startsWith("|");
      j++
    ) {
      const cells = splitRow(lines[j]);
      if (stateCol >= 0 && !/deprecated|retired/i.test(cells[stateCol] ?? ""))
        continue;
      const modelCell = cells[modelCol] ?? "";
      let ids = backticked(modelCell);
      if (ids.length === 0 && MODEL_ID.test(modelCell)) ids = [modelCell];
      const retireAt = parseMonthDate(cells[dateCol] ?? "");
      for (const id of ids) {
        if (MODEL_ID.test(id)) entries.push({ vendor, id, retireAt });
      }
    }
  }
  return { entries: dedupe(entries), markerFound };
}

/** xAI の移行ガイドを取りに行く上限（llms.txt が想定外に長くなっても取得を増やしすぎない） */
export const XAI_GUIDE_LIMIT = 20;

/** xAI の llms.txt から移行ガイド（.md）の URL を拾う */
export function parseXaiIndex(txt: string): string[] {
  const urls = [
    ...txt.matchAll(
      /\[Migration Guides[^\]]*\]\((https:\/\/docs\.x\.ai\/developers\/migration\/[^)\s]+\.md)\)/g,
    ),
  ].map((m) => m[1]);
  return [...new Set(urls)];
}

/**
 * xAI の移行ガイド。見出し "# ... Retirement on May 15, 2026" の節にある
 * "* `slug`" の箇条書きを引退モデルとする。
 * "at 12:00 PM PT" があれば PST（UTC-8）で換算する（PDT より 1 時間遅く、早めに消すことはない）
 */
export function parseXaiGuide(md: string): ParseResult {
  const entries: DeprecationEntry[] = [];
  let markerFound = false;
  const sections = md.split(/\n(?=# )/);
  for (const sec of sections) {
    const h = /^#\s.*Retirement on ([A-Za-z]+ \d{1,2}, \d{4})/m.exec(sec);
    if (!h) continue;
    markerFound = true;
    let retireAt = parseMonthDate(h[1]);
    const t = /at (\d{1,2}):(\d{2}) (AM|PM) PT/.exec(sec);
    const d = /([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(h[1]);
    if (t && d && retireAt) {
      const month = MONTHS.indexOf(d[1].slice(0, 3).toLowerCase()) + 1;
      let hour = Number(t[1]) % 12;
      if (t[3] === "PM") hour += 12;
      retireAt = localToUtc(
        Number(d[3]),
        month,
        Number(d[2]),
        hour,
        Number(t[2]),
        -8,
      );
    }
    for (const m of sec.matchAll(/^\s*[*-]\s+`([^`]+)`\s*$/gm)) {
      entries.push({ vendor: "xai", id: m[1], retireAt });
    }
  }
  return { entries: dedupe(entries), markerFound };
}

/**
 * Kimi のモデル一覧（## Deprecated Models 節）。
 * 引用文 "`kimi-k2.5` was officially discontinued on **August 31, 2026**" から日付を取り、
 * "The `kimi-k2` series models ..." は kimi-k2-* の表の行に日付を当てる（ベンダー自身の「シリーズ」宣言）
 */
export function parseKimi(md: string): ParseResult {
  const start = md.indexOf("## Deprecated Models");
  if (start < 0) return { entries: [], markerFound: false };
  const body = md.slice(start);
  const direct = new Map<string, string | null>();
  const series: { prefix: string; retireAt: string | null }[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith(">") || !/discontinued on/.test(line)) continue;
    const dm = /discontinued on \*\*([^*]+)\*\*/.exec(line);
    const retireAt = dm ? parseMonthDate(dm[1]) : null;
    const ids = backticked(line).filter((x) => MODEL_ID.test(x));
    if (/\bseries\b/.test(line) && ids.length > 0) {
      series.push({ prefix: ids[0], retireAt });
    } else {
      for (const id of ids) direct.set(id, retireAt);
    }
  }
  const entries: DeprecationEntry[] = [];
  for (const [id, retireAt] of direct)
    entries.push({ vendor: "kimi", id, retireAt });
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = splitRow(line);
    if (!/deprecated/i.test(cells[1] ?? "")) continue;
    for (const id of backticked(cells[0] ?? "")) {
      if (direct.has(id)) continue;
      const s = series.find(
        (x) => id === x.prefix || id.startsWith(`${x.prefix}-`),
      );
      entries.push({ vendor: "kimi", id, retireAt: s ? s.retireAt : null });
    }
  }
  return { entries: dedupe(entries), markerFound: true };
}

/** "Beijing Time 2026.10.21 10:00" → UTC ISO。読めなければ null */
function parseBeijingTime(text: string): string | null {
  const m =
    /^Beijing Time\s+(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(
      text.trim(),
    );
  if (!m) return null;
  return localToUtc(
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    8,
  );
}

/**
 * Xiaomi MiMo の廃止ページ（HTML 表）。見出しで列を決める:
 * モデル列 = "Model" を含み "Replacement" でない列、日付列 = "Deprecated Time"
 */
export function parseXiaomi(html: string): ParseResult {
  const entries: DeprecationEntry[] = [];
  let markerFound = false;
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((r) =>
      [...r.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
        htmlToText(c[1]).trim(),
      ),
    );
    if (rows.length === 0) continue;
    const heads = rows[0].map((h) => h.toLowerCase());
    const modelCol = heads.findIndex(
      (h) => h.includes("model") && !h.includes("replacement"),
    );
    const dateCol = heads.indexOf("deprecated time");
    if (modelCol < 0 || dateCol < 0) continue;
    markerFound = true;
    for (const cells of rows.slice(1)) {
      const id = (cells[modelCol] ?? "").toLowerCase();
      if (!MODEL_ID.test(id)) continue;
      entries.push({
        vendor: "xiaomi",
        id,
        retireAt: parseBeijingTime(cells[dateCol] ?? ""),
      });
    }
  }
  return { entries: dedupe(entries), markerFound };
}

/**
 * DeepSeek の Change Log。"Date: YYYY-MM-DD" の節にある
 * "models X and Y have been retired" を拾い、節の日付を停止日とする（引退済みの告知のため）
 */
export function parseDeepseek(html: string): ParseResult {
  const text = htmlToText(html);
  const parts = text.split(/Date: (\d{4}-\d{2}-\d{2})/);
  const markerFound = parts.length > 1;
  const entries: DeprecationEntry[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const [y, mo, d] = parts[i].split("-").map(Number);
    const retireAt = endOfDayAnywhere(y, mo, d);
    for (const m of parts[i + 1].matchAll(
      /\bmodels? ((?:(?!\bmodels?\b)[^.;])+?) (?:have|has) been retired/g,
    )) {
      for (const raw of m[1].split(/,\s*|\s+and\s+/)) {
        const name = raw.trim();
        if (!name) continue;
        const id = /^deepseek/i.test(name) ? name : `DeepSeek ${name}`;
        entries.push({ vendor: "deepseek", id, retireAt });
      }
    }
  }
  return { entries: dedupe(entries), markerFound };
}

export function parseVendorPage(vendor: Vendor, body: string): ParseResult {
  switch (vendor) {
    case "openai":
    case "anthropic":
    case "google":
      return parseMarkdownTables(body, vendor);
    case "xai":
      return parseXaiGuide(body);
    case "kimi":
      return parseKimi(body);
    case "xiaomi":
      return parseXiaomi(body);
    case "deepseek":
      return parseDeepseek(body);
  }
}

// --- 照合 ---

/** 末尾の日付（YYYY-MM-DD / YYYYMMDD / MMDD）を外す。MMDD は月日として妥当なものだけ */
function stripDateSuffix(s: string): { base: string; dated: boolean } {
  const m = /[-\s](\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/.exec(s);
  if (!m) return { base: s, dated: false };
  const v = m[1].replace(/-/g, "");
  const mmdd = v.length === 4 ? v : v.slice(4);
  const month = Number(mmdd.slice(0, 2));
  const day = Number(mmdd.slice(2));
  if (month < 1 || month > 12 || day < 1 || day > 31)
    return { base: s, dated: false };
  return { base: s.slice(0, m.index), dated: true };
}

/** AA の括弧書きのうち、推論モード・推論強度だけを表すもの（モデルの版ではない） */
const SETTING_PART =
  /^(?:adaptive )?(?:non-)?reasoning$|^(?:minimal|low|medium|high|xhigh|max)(?: effort)?$|fallback$|^thinking$/;

/**
 * 括弧書きが日付・スナップショットか（"Aug '24" / "Feb 2026" / "0902" / "2025-10-22"）。
 * 正規表現内の引用符は \x27 で書く（validate_workflows.py が正規表現内の引用符を文字列の開始と誤認するため）
 */
const DATE_PAREN =
  /^(?:[a-z]{3,9}\.?\s*\x27?\s*\d{2}(?:\d{2})?|\d{4}|\d{4}-\d{2}(?:-\d{2})?)$/;

/**
 * 照合キー。AA の表示名とベンダーの ID を同じ形にする。
 * - 推論モード・推論強度の括弧書き（"(Reasoning)" "(high)" 等）と、末尾の -reasoning / -non-reasoning は外す
 * - 日付・スナップショットの括弧書き（"(Aug '24)" "(0902)"）と末尾の日付は外し、dated=true にする
 * - それ以外の括弧書き（"(ChatGPT)" "(Preview)" 等）は語としてキーに残し、dated=true にする
 * - 英字と数字の境目で分け（"o3" → o 3, "k2.6" → k 2 6）、"." "-" "'" 空白で区切る
 * - 語は並べ替え（"Claude 4.5 Haiku" と "claude-haiku-4-5"）、数字は順序を保つ
 * - ignoreExp（DeepSeek のみ）: "exp" を無視する（"DeepSeek V4 Flash Vision" と "... Vision Exp"）
 *
 * dated はベンダー ID では「日付付きスナップショット」、AA 名では「版・日付の注記付き」を表す
 */
export function modelKey(
  name: string,
  opts: { ignoreExp?: boolean } = {},
): { key: string; dated: boolean } {
  let qualified = false;
  const kept: string[] = [];
  let s = name.toLowerCase().replace(/\s*\(([^)]*)\)/g, (_m, inner: string) => {
    const parts = inner
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0 && parts.every((p) => SETTING_PART.test(p))) return "";
    qualified = true;
    if (!DATE_PAREN.test(inner.trim())) kept.push(inner);
    return "";
  });
  s = s.trim().replace(/[-\s](?:non-)?reasoning$/, "");
  const { base, dated } = stripDateSuffix(s);
  const tokens = [base, ...kept]
    .join(" ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/[\s._\x27-]+/)
    .filter((t) => t && !(opts.ignoreExp && t === "exp"));
  const words = tokens.filter((t) => !/^\d+$/.test(t)).sort();
  const nums = tokens
    .filter((t) => /^\d+$/.test(t))
    .map((n) => String(Number(n)));
  return {
    key: `${words.join(" ")}|${nums.join(".")}`,
    dated: dated || qualified,
  };
}

/** "exp" を同一視するのは DeepSeek だけ（Gemini の *-exp などは別モデルとして扱う） */
const keyOpts = (vendor: Vendor) => ({ ignoreExp: vendor === "deepseek" });

interface KeyGroup {
  aliases: DeprecationEntry[];
  snapshots: DeprecationEntry[];
}

export type DeprecationIndex = Map<Vendor, Map<string, KeyGroup>>;

export function buildIndex(entries: DeprecationEntry[]): DeprecationIndex {
  const index: DeprecationIndex = new Map();
  for (const e of entries) {
    const { key, dated } = modelKey(e.id, keyOpts(e.vendor));
    let byKey = index.get(e.vendor);
    if (!byKey) {
      byKey = new Map();
      index.set(e.vendor, byKey);
    }
    let g = byKey.get(key);
    if (!g) {
      g = { aliases: [], snapshots: [] };
      byKey.set(key, g);
    }
    (dated ? g.snapshots : g.aliases).push(e);
  }
  return index;
}

/**
 * AA のモデルが、ベンダー公式の一覧で停止日を過ぎているか。
 * - 日付なしの ID（エイリアス）が一覧にあれば、それらが全て停止済みのときだけ一致
 * - エイリアスが無く、日付付きスナップショットが 1 つだけなら同じモデルとみなす（o3 ↔ o3-2025-04-16）。
 *   ただし AA 名に版・日付の注記（"GPT-4o (Aug '24)" 等）がある場合は、どのスナップショットか分からないので一致させない
 * - スナップショットが 2 つ以上でエイリアスが無い場合は一致させない
 */
export function findRetirement(
  aaName: string,
  provider: string,
  index: DeprecationIndex,
  now: Date,
): DeprecationEntry | null {
  const vendor = PROVIDER_VENDOR[provider];
  if (!vendor) return null;
  const aa = modelKey(aaName, keyOpts(vendor));
  const g = index.get(vendor)?.get(aa.key);
  if (!g) return null;
  if (g.aliases.length > 0) {
    return g.aliases.every((e) => isRetired(e, now)) ? g.aliases[0] : null;
  }
  if (!aa.dated && g.snapshots.length === 1 && isRetired(g.snapshots[0], now)) {
    return g.snapshots[0];
  }
  return null;
}
