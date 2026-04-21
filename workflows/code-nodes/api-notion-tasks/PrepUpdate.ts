export default function (): CodeNodeReturn {
  const input =
    ($input.first().json.body as IDataObject) || $input.first().json;
  const pageId = input.page_id as string;
  if (!pageId) {
    throw new Error("page_id is required for update action");
  }

  const body: IDataObject = { properties: {} as IDataObject };
  const props = body.properties as IDataObject;

  if (input.name !== undefined) {
    props[""] = { title: [{ text: { content: input.name } }] };
  }

  if (input.status !== undefined) {
    props.ステータス = { status: { name: input.status } };
  }

  if (input.parent_id !== undefined) {
    if (input.parent_id) {
      props.親タスク = { relation: [{ id: input.parent_id }] };
    } else {
      props.親タスク = { relation: [] };
    }
  }

  const taskContent = input.content || null;
  const result: IDataObject = {
    pageId,
    requestBody: JSON.stringify(body),
    content: taskContent,
  };

  if (input.cover_url) {
    const bodyWithCover = JSON.parse(result.requestBody as string);
    bodyWithCover.cover = {
      type: "external",
      external: { url: input.cover_url },
    };
    result.requestBody = JSON.stringify(bodyWithCover);
  }

  return [{ json: result }];
}
