export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const databaseId = body.database_id as string;
  if (typeof databaseId !== "string" || !databaseId) {
    throw new Error("database_id is required (string)");
  }

  const requestBody: IDataObject = {};
  if (body.filter && typeof body.filter === "object") {
    requestBody.filter = body.filter;
  }
  if (Array.isArray(body.sorts)) {
    requestBody.sorts = body.sorts;
  }
  if (typeof body.page_size === "number") {
    requestBody.page_size = Math.min(Math.max(body.page_size, 1), 100);
  }
  if (typeof body.start_cursor === "string" && body.start_cursor) {
    requestBody.start_cursor = body.start_cursor;
  }

  return [
    {
      json: {
        url: `https://api.notion.com/v1/databases/${databaseId}/query`,
        requestBody: JSON.stringify(requestBody),
      },
    },
  ];
}
