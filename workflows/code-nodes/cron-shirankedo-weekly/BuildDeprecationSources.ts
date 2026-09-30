import { DEPRECATION_SOURCES } from "./_shared/deprecations";

/** 廃止一覧の取得先（1 回目）。FetchDeprecationPages が 1 件ずつ GET する */
export default function (): CodeNodeReturn {
  return DEPRECATION_SOURCES.map((s) => ({ json: { ...s } }));
}
