export default function (): CodeNodeReturn {
  const ids = ($input.first().json.allPageIds as string[]) || [];
  if (ids.length === 0) return [];
  const updateBody = JSON.stringify({
    properties: { ステータス: { select: { name: "既読" } } },
  });
  return ids.map((pageId: string) => ({
    json: { pageId, requestBody: updateBody },
  }));
}
