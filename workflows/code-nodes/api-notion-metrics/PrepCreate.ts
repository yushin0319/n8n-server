interface CreateInput {
  date?: string;
  total?: number;
  success?: number;
  error?: number;
  waiting?: number;
  error_rate_pct?: number;
  avg_duration_sec?: number;
  coverage_hours?: number;
  top_wf?: string;
  recent_errors?: string;
}

const DB_ID = "34d2570f-e49f-800e-82f8-dca2c6b1f1d3";
const NUMBER_KEYS: (keyof CreateInput)[] = [
  "total",
  "success",
  "error",
  "waiting",
  "error_rate_pct",
  "avg_duration_sec",
  "coverage_hours",
];
const TEXT_KEYS: (keyof CreateInput)[] = ["top_wf", "recent_errors"];

export default function (): CodeNodeReturn {
  const raw = $input.first().json as IDataObject;
  const input = ((raw.body as CreateInput | undefined) || raw) as CreateInput;

  const date =
    typeof input.date === "string" && input.date
      ? input.date
      : new Date().toISOString().slice(0, 10);

  const props: IDataObject = {
    日付: { title: [{ text: { content: date } }] },
  };

  for (const key of NUMBER_KEYS) {
    const v = input[key];
    if (typeof v === "number") {
      props[key] = { number: v };
    }
  }

  for (const key of TEXT_KEYS) {
    const v = input[key];
    if (typeof v === "string" && v) {
      props[key] = { rich_text: [{ text: { content: v } }] };
    }
  }

  const body: IDataObject = {
    parent: { database_id: DB_ID },
    properties: props,
  };

  return [{ json: { requestBody: JSON.stringify(body) } }];
}
