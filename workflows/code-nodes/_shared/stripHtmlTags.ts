/**
 * HTMLタグを安全に除去する。
 * 単一パスでは `<scr<script>ipt>` のような入れ子が残るため、
 * 変化がなくなるまでループする（CodeQL js/incomplete-multi-character-sanitization 対策）。
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== "string") return "";
  const tagPattern = /<[^>]+>/g;
  let prev = html;
  let result = html.replace(tagPattern, "");
  while (result !== prev) {
    prev = result;
    result = result.replace(tagPattern, "");
  }
  return result;
}
