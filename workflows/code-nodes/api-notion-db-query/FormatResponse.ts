export default function (): CodeNodeReturn {
  function extractPropValue(prop: IDataObject): unknown {
    if (!prop || typeof prop !== "object") return null;
    const t = prop.type as string;
    switch (t) {
      case "title":
      case "rich_text": {
        const arr = prop[t] as IDataObject[] | undefined;
        return arr?.map((x) => x.plain_text).join("") ?? "";
      }
      case "select": {
        const sel = prop.select as IDataObject | null | undefined;
        return sel?.name ?? null;
      }
      case "multi_select": {
        const arr = prop.multi_select as IDataObject[] | undefined;
        return arr?.map((x) => x.name) ?? [];
      }
      case "date": {
        const d = prop.date as IDataObject | null | undefined;
        return d?.start ?? null;
      }
      case "url":
        return prop.url ?? null;
      case "number":
        return prop.number ?? null;
      case "checkbox":
        return prop.checkbox ?? false;
      case "people":
        return ((prop.people as IDataObject[]) ?? []).map((p) => p.id);
      default:
        return prop[t] ?? null;
    }
  }

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

  const results = Array.isArray(resp.results) ? resp.results : [];
  const flat = results.map((page: unknown) => {
    const p = page as IDataObject;
    const props = (p.properties ?? {}) as IDataObject;
    const out: IDataObject = {
      page_id: p.id,
      created_time: p.created_time,
      last_edited_time: p.last_edited_time,
      url: p.url,
    };
    for (const [name, prop] of Object.entries(props)) {
      out[name] = extractPropValue(prop as IDataObject);
    }
    return out;
  });

  return [
    {
      json: {
        success: true,
        count: flat.length,
        next_cursor: resp.next_cursor,
        has_more: resp.has_more,
        results: flat,
      },
    },
  ];
}
