import {
  notionLastEdited,
  notionRelation,
  notionStatus,
  notionTitle,
  notionUniqueId,
} from "../_shared/notionProps";

export default function (): CodeNodeReturn {
  // 0 件のとき前の Notion ノードが alwaysOutputData で流す空の 1 件を除く
  const pages = $input.all().filter((item) => item.json.id);
  const tasks = pages.map((item) => {
    const page = item.json as IDataObject;
    const props = page.properties as IDataObject;
    const title = notionTitle(props, "", "(無題)");
    const status = notionStatus(props, "ステータス", "不明");
    const id = page.id;
    const uniqueId = notionUniqueId(props, "ID");
    const parentRels = notionRelation(props, "親タスク");
    const childRels = notionRelation(props, "子タスク");
    const lastEdited = notionLastEdited(props, "最終更新日時");
    const url = page.url;
    return {
      id,
      task_id: uniqueId,
      title,
      status,
      parent_tasks: parentRels,
      child_tasks: childRels,
      last_edited: lastEdited,
      url,
    };
  });
  return [{ json: { action: "list", count: tasks.length, tasks } }];
}
