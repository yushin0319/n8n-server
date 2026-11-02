// select の値。Notion は選択肢に無い名前を渡されると新しい選択肢を作るので、
// 前後の空白を削って決まった値だけを通す
function choice(
  value: unknown,
  key: string,
  allowed: string[],
): string | undefined {
  if (value == null) return undefined;
  const v = String(value).trim();
  if (!allowed.includes(v)) {
    throw new Error(`${key} は ${allowed.join(" / ")} のどれか: ${v}`);
  }
  return v;
}

export default function (): CodeNodeReturn {
  const input =
    ($input.first().json.body as IDataObject) || $input.first().json;
  const pageId = input.page_id as string;
  if (!pageId) throw new Error("page_id is required");
  return [
    {
      json: {
        pageId,
        importance: choice(input.importance, "importance", [
          "重要",
          "確認",
          "不要",
        ]),
        reason: input.reason as string | undefined,
        emailStatus: choice(input.status, "status", ["未読", "既読"]),
      },
    },
  ];
}
