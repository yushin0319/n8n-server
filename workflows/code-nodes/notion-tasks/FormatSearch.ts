import {
  notionLastEdited,
  notionStatus,
  notionTitle,
  notionUniqueId,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const tasks = results.map((page: IDataObject) => {
    const props = page.properties as IDataObject;
    const title = notionTitle(props, "", "(無題)");
    const status = notionStatus(props, "ステータス", "不明");
    const id = page.id;
    const uniqueId = notionUniqueId(props, "ID");
    const lastEdited = notionLastEdited(props, "最終更新日時");
    const url = page.url;
    return {
      id,
      task_id: uniqueId,
      title,
      status,
      last_edited: lastEdited,
      url,
    };
  });
  return [{ json: { action: "search", count: tasks.length, tasks } }];
}
