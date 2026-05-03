export default function (): CodeNodeReturn {
  const resp = $input.first().json as IDataObject;

  if (resp.object === "error") {
    return [
      {
        json: {
          success: false,
          error: {
            code: resp.code ?? "unknown",
            message: resp.message ?? "Notion API error",
            status: resp.status ?? null,
          },
        },
      },
    ];
  }

  const props = (resp.properties ?? {}) as IDataObject;
  return [
    {
      json: {
        success: true,
        database_id: resp.id,
        title: resp.title,
        property_count: Object.keys(props).length,
        properties: Object.keys(props),
      },
    },
  ];
}
