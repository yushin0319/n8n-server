export default function (): CodeNodeReturn {
  const input =
    ($input.first().json.body as IDataObject) || $input.first().json;
  const pageId = input.page_id as string;
  if (!pageId) throw new Error("page_id is required");
  return [
    {
      json: {
        pageId,
        importance: input.importance as string | undefined,
        reason: input.reason as string | undefined,
        emailStatus: input.status as string | undefined,
      },
    },
  ];
}
