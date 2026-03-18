/**
 * Notion プロパティ抽出ユーティリティ.
 * Notion API レスポンスの properties から型別に値を取り出す。
 */

/** title テキストを抽出 */
export function notionTitle(
  props: IDataObject,
  key: string,
  fallback?: string,
): string {
  const arr = ((props[key] as IDataObject)?.title as IDataObject[]) || [];
  return (
    arr.map((t: IDataObject) => t.plain_text).join("") || (fallback ?? "(無題)")
  );
}

/** rich_text テキストを抽出 */
export function notionRichText(
  props: IDataObject,
  key: string,
  fallback?: string,
): string {
  const arr = ((props[key] as IDataObject)?.rich_text as IDataObject[]) || [];
  return arr.map((t: IDataObject) => t.plain_text).join("") || (fallback ?? "");
}

/** select 名を抽出 */
export function notionSelect(
  props: IDataObject,
  key: string,
  fallback?: string,
): string {
  return (
    (((props[key] as IDataObject)?.select as IDataObject)?.name as string) ||
    (fallback ?? "")
  );
}

/** status 名を抽出 */
export function notionStatus(
  props: IDataObject,
  key: string,
  fallback?: string,
): string {
  return (
    (((props[key] as IDataObject)?.status as IDataObject)?.name as string) ||
    (fallback ?? "")
  );
}

/** date.start を抽出 */
export function notionDate(props: IDataObject, key: string): string {
  const dateProp = props[key] as IDataObject;
  return dateProp?.date
    ? ((dateProp.date as IDataObject)?.start as string) || ""
    : "";
}

/** unique_id.number を抽出 */
export function notionUniqueId(
  props: IDataObject,
  key: string,
): number | undefined {
  return ((props[key] as IDataObject)?.unique_id as IDataObject)?.number as
    | number
    | undefined;
}

/** relation ID 配列を抽出 */
export function notionRelation(props: IDataObject, key: string): string[] {
  return (((props[key] as IDataObject)?.relation as IDataObject[]) || []).map(
    (r: IDataObject) => r.id as string,
  );
}

/** multi_select の最初の名前を抽出 */
export function notionMultiSelectFirst(
  props: IDataObject,
  key: string,
  fallback?: string,
): string {
  const arr = (props[key] as IDataObject)?.multi_select as
    | IDataObject[]
    | undefined;
  return (arr?.[0]?.name as string) || (fallback ?? "");
}

/** last_edited_time を抽出 */
export function notionLastEdited(props: IDataObject, key: string): string {
  return ((props[key] as IDataObject)?.last_edited_time as string) || "";
}
