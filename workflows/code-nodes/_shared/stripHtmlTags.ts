/**
 * HTMLタグを安全に除去する。
 * 単一パスでは `<scr<script>ipt>` のような入れ子が残るため、
 * 変化がなくなるまでループする（CodeQL js/incomplete-multi-character-sanitization 対策）。
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== "string") return "";
  let result = html;
  while (result !== (result = result.replace(/<[^>]+>/g, ""))) {
    // ループで安定するまで繰り返す
  }
  return result;
}
