export default function (): CodeNodeReturn {
  const input =
    ($input.first().json.body as IDataObject) || $input.first().json;
  const filters: IDataObject[] = [];
  if (input.status) {
    filters.push({ property: "ステータス", status: { equals: input.status } });
  }
  if (input.query) {
    filters.push({ property: "", title: { contains: input.query } });
  }
  if (input.date_from) {
    filters.push({
      property: "最終更新日時",
      last_edited_time: { on_or_after: input.date_from },
    });
  }
  if (input.date_to) {
    filters.push({
      property: "最終更新日時",
      last_edited_time: { on_or_before: input.date_to },
    });
  }
  const filter =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : { and: filters };
  return [{ json: { filterJson: filter ? JSON.stringify(filter) : "" } }];
}
