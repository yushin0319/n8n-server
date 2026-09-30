/**
 * LLM ベンダー公式の廃止（deprecation / retirement）一覧の取得元・解析・照合。
 *
 * 方針（2026-09-30 決定）:
 * - ベンダー公式の一覧に載り、停止日を過ぎたモデルだけを除外する。推測では除外しない
 * - 一覧が取れない・読めない社は、その社の除外を 0 件として扱う（fail-open）
 * - 日付を読めないエントリは除外しない
 * - 「最短でこの日以降に停止」（Google の Shutdown date、"at earliest"、"Not sooner than"）では除外しない。
 *   Google は models ページで "(Shut down)" と表示されたモデルだけを停止済みとする
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
    // deprecations ページの Shutdown date は「最短の停止日」なので使わない。
    // models ページで "(Shut down)" と表示されたものだけを停止済みとする
    url: "https://ai.google.dev/gemini-api/docs/models.md.txt",
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

/**
 * 廃止エントリ。
 * - retireAt: 停止時刻（UTC ISO）。読めなければ null
 * - stopped: 停止済みと明示されている（Google models ページの "(Shut down)"）。日付は無い
 * - nullKind: retireAt が null の理由。"earliest" は「最短でこの日以降」の注記、"tbd" は未定・延期
 * - earliestAt: 「最短でこの日以降」の日付（読めた場合）。この時刻より前には除外しない
 */
export interface DeprecationEntry {
  vendor: Vendor;
  id: string;
  retireAt: string | null;
  stopped?: boolean;
  nullKind?: "earliest" | "tbd";
  earliestAt?: string;
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

const EARLIEST_PREFIX =
  /^\s*\**\s*(?:at earliest|not sooner than|earliest)\s*:?\s*/i;

/** 日付セルが読めないときの理由。「最短でこの日以降」の注記なら earliest、それ以外は tbd */
export function nullKindOf(text: string): "earliest" | "tbd" {
  return EARLIEST_PREFIX.test(text) ? "earliest" : "tbd";
}

/** 「at earliest 2024-06-13」「Not sooner than September 1, 2027」の日付。読めなければ undefined */
export function parseEarliest(text: string): string | undefined {
  if (!EARLIEST_PREFIX.test(text)) return undefined;
  return parseMonthDate(text.replace(EARLIEST_PREFIX, "")) ?? undefined;
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

/** 停止時刻を過ぎたか。停止済みの明示は true、日付不明は過ぎていない扱い */
export function isRetired(entry: DeprecationEntry, now: Date): boolean {
  if (entry.stopped) return true;
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
 * 同じ ID が複数の表に載る場合の統合。早めには消さない側に寄せる:
 * - 日付未定・延期（tbd）が 1 つでもあれば、除外しない（retireAt: null）
 * - 確定した停止日は遅いほうを採る。「最短でこの日以降」（earliestAt）がそれより遅ければ earliestAt を採る
 *   （例: gpt-4-0314 は古い "at earliest 2024-06-13" と確定 2026-03-26 → 2026-03-26 の翌日 12:00 UTC）
 * - 「最短」の注記だけで確定日が無い場合は除外しない（earliestAt は残す）
 * - 停止済みの明示（stopped）は確定扱い
 */
function dedupe(entries: DeprecationEntry[]): DeprecationEntry[] {
  const groups = new Map<string, DeprecationEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.id);
    if (list) list.push(e);
    else groups.set(e.id, [e]);
  }
  const later = (a?: string | null, b?: string | null) =>
    !a ? (b ?? undefined) : !b ? a : a > b ? a : b;
  const out: DeprecationEntry[] = [];
  for (const [id, list] of groups) {
    const vendor = list[0].vendor;
    let confirmed: string | undefined;
    let earliest: string | undefined;
    let stopped = false;
    let tbd = false;
    for (const e of list) {
      if (e.stopped) stopped = true;
      if (e.retireAt) confirmed = later(confirmed, e.retireAt);
      if (e.earliestAt) earliest = later(earliest, e.earliestAt);
      if (!e.stopped && !e.retireAt && e.nullKind !== "earliest") tbd = true;
    }
    if (tbd) {
      out.push({ vendor, id, retireAt: null, nullKind: "tbd" });
    } else if (stopped && !confirmed) {
      // 停止済みの明示。「最短」の日付があればそれより前には消さない
      out.push(
        earliest
          ? { vendor, id, retireAt: earliest }
          : { vendor, id, retireAt: null, stopped: true },
      );
    } else if (confirmed) {
      out.push({
        vendor,
        id,
        retireAt: later(confirmed, earliest) ?? confirmed,
      });
    } else {
      out.push(
        earliest
          ? {
              vendor,
              id,
              retireAt: null,
              nullKind: "earliest",
              earliestAt: earliest,
            }
          : { vendor, id, retireAt: null, nullKind: "earliest" },
      );
    }
  }
  return out;
}

// --- ベンダー別パーサー ---

/**
 * OpenAI / Anthropic の Markdown 表。
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
      const dateCell = cells[dateCol] ?? "";
      const retireAt = parseMonthDate(dateCell);
      for (const id of ids) {
        if (!MODEL_ID.test(id)) continue;
        entries.push(
          retireAt
            ? { vendor, id, retireAt }
            : {
                vendor,
                id,
                retireAt,
                nullKind: nullKindOf(dateCell),
                ...(parseEarliest(dateCell)
                  ? { earliestAt: parseEarliest(dateCell) }
                  : {}),
              },
        );
      }
    }
  }
  return { entries: dedupe(entries), markerFound };
}

/**
 * Google の models ページ（Markdown）。"Endpoint" 列のある表で、モデル名のセルに
 * "(Shut down)" が付いた行を停止済みとする（停止日は書かれていない）
 */
export function parseGoogleModels(md: string): ParseResult {
  const lines = md.split(/\r?\n/);
  const entries: DeprecationEntry[] = [];
  let markerFound = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (
      !lines[i].trim().startsWith("|") ||
      !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])
    )
      continue;
    const heads = splitRow(lines[i]).map((h) => h.toLowerCase());
    const endpointCol = heads.indexOf("endpoint");
    if (endpointCol < 0) continue;
    markerFound = true;
    for (
      let j = i + 2;
      j < lines.length && lines[j].trim().startsWith("|");
      j++
    ) {
      const cells = splitRow(lines[j]);
      if (!/\(shut down\)/i.test(cells[0] ?? "")) continue;
      for (const id of backticked(cells[endpointCol] ?? "")) {
        if (MODEL_ID.test(id))
          entries.push({ vendor: "google", id, retireAt: null, stopped: true });
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
    // 本文は "." を含む版番号（V4.1）を許し、文末の "." で止める
    for (const m of parts[i + 1].matchAll(
      /\bmodels? ((?:(?!\bmodels?\b)(?:[^.;]|\.(?=\d)))+?) (?:have|has) been retired/gi,
    )) {
      for (const raw of m[1].split(/,\s*(?:and\s+)?|\s+and\s+/)) {
        // "model aliases X" / "aliases X" / "names X" の前置きを外す
        const name = raw
          .trim()
          .replace(/^(?:model\s+)?(?:aliases?|names?)\s+/i, "");
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
      return parseMarkdownTables(body, vendor);
    case "google":
      return parseGoogleModels(body);
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

/** ID 末尾の日付。year が無い（MMDD / MM-DD）場合と、日が無い（MM-YYYY）場合がある */
interface SuffixDate {
  year?: number;
  month: number;
  day?: number;
}

/**
 * 末尾の日付（YYYY-MM-DD / YYYYMMDD / MMDD）を外す。月日として妥当なものだけ。
 * vendorId=true（ベンダーの ID）のときだけ、preview / exp の直後の MM-DD / MM-YYYY も日付とみなす
 * （AA の表示名には適用しない）。
 * 例: o3-2025-04-16 / claude-3-haiku-20240307 / grok-4-0709 /
 *     gemini-2.5-pro-preview-03-25 / gemini-2.5-flash-lite-preview-09-2025（ベンダー ID のみ）
 */
function stripDateSuffix(
  s: string,
  vendorId = false,
): {
  base: string;
  dated: boolean;
  date?: SuffixDate;
} {
  // ベンダー ID の preview / exp の直後の MM-DD / MM-YYYY を先に見る（"-09-2025" を MMDD と読まないため）
  const short = vendorId
    ? /-(?:preview|exp)-(\d{2})-(\d{2}|\d{4})$/.exec(s)
    : null;
  if (short) {
    const month = +short[1];
    const date: SuffixDate =
      short[2].length === 4
        ? { year: +short[2], month }
        : { month, day: +short[2] };
    const okDay = date.day === undefined || (date.day >= 1 && date.day <= 31);
    const okYear =
      date.year === undefined || (date.year >= 2000 && date.year <= 2099);
    if (month >= 1 && month <= 12 && okDay && okYear) {
      // "preview" / "exp" は残し、日付部分だけ外す
      return {
        base: s.slice(0, s.length - short[1].length - short[2].length - 2),
        dated: true,
        date,
      };
    }
  }
  const m =
    /[-\s](\d{4})-(\d{2})-(\d{2})$|[-\s](\d{4})(\d{2})(\d{2})$|[-\s](\d{2})(\d{2})$/.exec(
      s,
    );
  if (!m) return { base: s, dated: false };

  let date: SuffixDate;
  if (m[1]) date = { year: +m[1], month: +m[2], day: +m[3] };
  else if (m[4]) date = { year: +m[4], month: +m[5], day: +m[6] };
  else date = { month: +m[7], day: +m[8] };
  const okMonth = date.month >= 1 && date.month <= 12;
  const okDay = date.day === undefined || (date.day >= 1 && date.day <= 31);
  const okYear =
    date.year === undefined || (date.year >= 2000 && date.year <= 2099);
  if (!okMonth || !okDay || !okYear) return { base: s, dated: false };
  return { base: s.slice(0, m.index), dated: true, date };
}

/** スナップショットの日付が AA の公開日から ±days 日以内か。年・日が無い場合は公開日の前後の年で最も近いものを使う */
export function snapshotNearRelease(
  id: string,
  releaseDate: string | null | undefined,
  days = 7,
): boolean {
  const date = stripDateSuffix(id.toLowerCase(), true).date;
  if (!date || date.day === undefined || !releaseDate) return false;
  const rel = Date.parse(`${releaseDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(rel)) return false;
  const relYear = new Date(rel).getUTCFullYear();
  const years =
    date.year !== undefined ? [date.year] : [relYear - 1, relYear, relYear + 1];
  const limit = days * 24 * 60 * 60 * 1000;
  return years.some(
    (y) =>
      Math.abs(Date.UTC(y, date.month - 1, date.day as number) - rel) <= limit,
  );
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
  opts: { ignoreExp?: boolean; vendorId?: boolean } = {},
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
  const { base, dated } = stripDateSuffix(s, opts.vendorId);
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
    const { key, dated } = modelKey(e.id, {
      ...keyOpts(e.vendor),
      vendorId: true,
    });
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
 * - 日付なしの ID（エイリアス）が一覧にあれば、それらが全て停止済みのときだけ一致。
 *   ただし AA 名に版・日付の注記がある（"MiMo-V2-Flash (Feb 2026)" 等）場合は、その版が止まったか分からないので、
 *   同じキーの日付付きスナップショットが 1 つ以上あり全て停止済みのときだけ一致させる
 * - エイリアスが無く、日付付きスナップショットが 1 つだけで、その日付が AA の公開日（release_date）から
 *   ±7 日以内なら同じモデルとみなす（o3 ↔ o3-2025-04-16）。公開日が無い場合は一致させない。
 *   AA 名に版・日付の注記（"GPT-4o (Aug '24)" 等）がある場合も、どのスナップショットか分からないので一致させない
 * - スナップショットが 2 つ以上でエイリアスが無い場合は一致させない
 */
export function findRetirement(
  aaName: string,
  provider: string,
  index: DeprecationIndex,
  now: Date,
  releaseDate?: string | null,
): DeprecationEntry | null {
  const vendor = PROVIDER_VENDOR[provider];
  if (!vendor) return null;
  const aa = modelKey(aaName, keyOpts(vendor));
  const g = index.get(vendor)?.get(aa.key);
  if (!g) return null;
  if (g.aliases.length > 0) {
    if (!g.aliases.every((e) => isRetired(e, now))) return null;
    if (
      aa.dated &&
      !(g.snapshots.length > 0 && g.snapshots.every((e) => isRetired(e, now)))
    )
      return null;
    return g.aliases[0];
  }
  if (
    !aa.dated &&
    g.snapshots.length === 1 &&
    snapshotNearRelease(g.snapshots[0].id, releaseDate) &&
    isRetired(g.snapshots[0], now)
  ) {
    return g.snapshots[0];
  }
  return null;
}
