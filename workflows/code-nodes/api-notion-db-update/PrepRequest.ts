export default function (): CodeNodeReturn {
  const body = ($input.first().json.body as IDataObject) || ({} as IDataObject);
  const databaseId = body.database_id;
  const properties = body.properties;

  if (typeof databaseId !== "string" || !databaseId) {
    throw new Error("database_id is required (string)");
  }
  if (typeof properties !== "object" || properties === null) {
    throw new Error("properties is required (object)");
  }

  const requestBody: IDataObject = { properties: properties as IDataObject };

  return [
    {
      json: {
        url: `https://api.notion.com/v1/databases/${databaseId}`,
        requestBody: JSON.stringify(requestBody),
      },
    },
  ];
}
