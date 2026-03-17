export default function (): CodeNodeReturn {
  const results = ($input.first().json.results as IDataObject[]) || [];
  const blockIds = results.map((b: IDataObject) => b.id as string);
  if (blockIds.length === 0) {
    return [{ json: { hasBlocks: false } }];
  }
  return blockIds.map((id: string) => ({
    json: { hasBlocks: true, blockId: id },
  }));
}
