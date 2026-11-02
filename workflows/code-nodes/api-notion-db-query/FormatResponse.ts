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

  // Notion は 1 回の問い合わせ (同じ絞り込み・並び順) で 1 万件までしか返さず、上限に達すると
  // has_more=false のまま全ページに request_status.type="incomplete" を付ける。捨てると黙って欠ける
  const requestStatus =
    (resp.request_status as IDataObject | undefined) ?? null;
  return [
    {
      json: {
        success: true,
        count: flat.length,
        next_cursor: resp.next_cursor,
        has_more: resp.has_more,
        incomplete: requestStatus?.type === "incomplete",
        request_status: requestStatus,
        results: flat,
      },
    },
  ];
}
