import {
  notionDate,
  notionMultiSelectFirst,
  notionRichText,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const allItems = $input.all();
  // ネイティブノードが0件の場合: alwaysOutputDataで空jsonアイテムが来る
  if (allItems.length === 0 || !allItems[0].json.properties) {
    return [{ json: { hasDue: false } }];
  }
  const items = allItems.map((item) => {
    const page = item.json as IDataObject;
    const props = page.properties as Record<string, IDataObject>;
    const titleEntry = Object.entries(props).find(
      ([_k, v]) => v.type === "title",
    );
    const titleArr = titleEntry ? (titleEntry[1].title as IDataObject[]) : [];
    const taskName =
      titleArr.length > 0
        ? titleArr.map((t: IDataObject) => t.plain_text).join("")
        : "(無題)";
    const frequency = notionMultiSelectFirst(props, "頻度", "monthly");
    const templateText = notionRichText(props, "テンプレ本文");
    // 次回予定日を下流に渡し、PrepUpdate で曜日固定の加算ベースにする
    const currentNextDate = notionDate(props, "次回予定日");
    const defPageId = page.id;
    return {
      json: {
        hasDue: true,
        defPageId,
        taskName,
        frequency,
        templateText,
        currentNextDate,
      },
    };
  });
  return items;
}
