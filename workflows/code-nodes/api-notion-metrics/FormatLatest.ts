interface NotionPage {
  id?: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: IDataObject;
}

function getNumber(props: IDataObject | undefined, key: string): number | null {
  if (!props) return null;
  const p = props[key] as IDataObject | undefined;
  if (!p) return null;
  const num = p.number;
  return typeof num === "number" ? num : null;
}

function getRichText(props: IDataObject | undefined, key: string): string {
  if (!props) return "";
  const p = props[key] as IDataObject | undefined;
  if (!p) return "";
  const arr = (p.rich_text || p.title) as IDataObject[] | undefined;
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => (t.plain_text as string) || "").join("");
}

export default function (): CodeNodeReturn {
  const items = $input.all();
  const count = items.length;
  if (count === 0) {
    return [
      {
        json: {
          action: "latest",
          count: 0,
          row: null,
          message: "DB は空です（接続は OK）",
        },
      },
    ];
  }

  const page = items[0].json as NotionPage;
  const props = page.properties;
  const row = {
    id: page.id,
    url: page.url,
    last_edited: page.last_edited_time,
    date: getRichText(props, "日付"),
    total: getNumber(props, "total"),
    success: getNumber(props, "success"),
    error: getNumber(props, "error"),
    waiting: getNumber(props, "waiting"),
    error_rate_pct: getNumber(props, "error_rate_pct"),
    avg_duration_sec: getNumber(props, "avg_duration_sec"),
    coverage_hours: getNumber(props, "coverage_hours"),
    top_wf: getRichText(props, "top_wf"),
    recent_errors: getRichText(props, "recent_errors"),
  };

  return [
    {
      json: {
        action: "latest",
        count,
        row,
      },
    },
  ];
}
