export default function (): CodeNodeReturn {
  const input = ($input.first().json.body as IDataObject) || $input.first().json;
  const pageId = input.page_id as string;
  if (!pageId) throw new Error("page_id is required");
  const body: IDataObject = { properties: {} as IDataObject };
  const props = body.properties as IDataObject;
  if (input.importance !== undefined) {
    props["重要度"] = { select: { name: input.importance } };
  }
  if (input.reason !== undefined) {
    props["理由"] = {
      rich_text: [{ text: { content: input.reason } }],
    };
  }
  if (input.status !== undefined) {
    props["ステータス"] = { select: { name: input.status } };
  }
  return [{ json: { pageId, requestBody: JSON.stringify(body) } }];
}
