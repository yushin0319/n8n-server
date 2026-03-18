export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const tasks = results.map((page: IDataObject) => {
    const props = page.properties as IDataObject;
    const titleArr = ((props[""] as IDataObject)?.title as IDataObject[]) || [];
    const title =
      titleArr.map((t: IDataObject) => t.plain_text).join("") || "(無題)";
    const status =
      ((props["ステータス"] as IDataObject)?.status as IDataObject)?.name ||
      "不明";
    const id = page.id;
    const uniqueId = ((props["ID"] as IDataObject)?.unique_id as IDataObject)
      ?.number;
    const lastEdited =
      (props["最終更新日時"] as IDataObject)?.last_edited_time || "";
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
