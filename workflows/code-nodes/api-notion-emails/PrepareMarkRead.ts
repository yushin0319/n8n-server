export default function (): CodeNodeReturn {
  const ids = ($input.first().json.allPageIds as string[]) || [];
  if (ids.length === 0) return [];
  return ids.map((pageId: string) => ({
    json: { pageId },
  }));
}
