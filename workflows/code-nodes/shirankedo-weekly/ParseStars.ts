export default function (): CodeNodeReturn {
  // staticDataからstar結果を取り出してPOST用に整形
  const staticData = $getWorkflowStaticData("global");
  const stars = (staticData.stars || []) as IDataObject[];
  staticData.stars = [];

  // 50件チャンクに分割
  const chunks: IDataObject[][] = [];
  for (let i = 0; i < stars.length; i += 50) {
    chunks.push(stars.slice(i, i + 50));
  }
  if (chunks.length === 0) chunks.push([]);

  return chunks.map((chunk, idx) => ({
    json: {
      requestBody: JSON.stringify(chunk),
      count: chunk.length,
      chunkIndex: idx,
      totalChunks: chunks.length,
      totalStars: stars.length,
    },
  }));
}
