export default function (): CodeNodeReturn {
  const input =
    ($input.first().json.body as IDataObject) || $input.first().json;
  const filters: IDataObject[] = [];
  if (input.importance) {
    filters.push({
      property: "importance",
      select: { equals: input.importance },
    });
  }
  if (input.status) {
    filters.push({
      property: "status",
      select: { equals: input.status },
    });
  }
  if (input.query) {
    filters.push({ property: "subject", title: { contains: input.query } });
  }
  if (input.from) {
    filters.push({
      property: "sender",
      rich_text: { contains: input.from },
    });
  }
  if (input.date_from) {
    filters.push({
      property: "date",
      date: { on_or_after: input.date_from },
    });
  }
  if (input.date_to) {
    filters.push({
      property: "date",
      date: { on_or_before: input.date_to },
    });
  }
  const filter =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? filters[0]
        : { and: filters };
  return [
    {
      json: {
        filterJson: JSON.stringify(filter ?? {}),
        limit: input.limit ? Math.min(input.limit as number, 100) : undefined,
      },
    },
  ];
}
