export default function (): CodeNodeReturn {
  const queryBody = JSON.stringify({
    filter: { property: "ステータス", select: { equals: "未読" } },
    sorts: [{ property: "日時", direction: "descending" }],
  });
  return [{ json: { queryBody } }];
}
