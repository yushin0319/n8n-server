export default function (): CodeNodeReturn {
  const input = ($input.first().json.body as IDataObject) || $input.first().json;
  const filters: IDataObject[] = [];
  if (input.importance) {
    filters.push({
      property: "重要度",
      select: { equals: input.importance },
    });
  }
  if (input.status) {
    filters.push({
      property: "ステータス",
      select: { equals: input.status },
    });
  }
  if (input.query) {
    filters.push({ property: "件名", title: { contains: input.query } });
  }
  if (input.from) {
    filters.push({
      property: "差出人",
      rich_text: { contains: input.from },
    });
  }
  if (input.date_from) {
    filters.push({
      property: "日時",
      date: { on_or_after: input.date_from },
    });
  }
  if (input.date_to) {
    filters.push({
      property: "日時",
      date: { on_or_before: input.date_to },
    });
  }
  const body: IDataObject = {};
  if (filters.length > 0) {
    body.filter = filters.length === 1 ? filters[0] : { and: filters };
  }
  body.sorts = [{ property: "日時", direction: "descending" }];
  if (input.limit) {
    body.page_size = Math.min(input.limit as number, 100);
  }
  return [{ json: { requestBody: JSON.stringify(body) } }];
}
