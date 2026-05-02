/**
 * UploadFile 後、PrepUpload で抽出した ids 配列を SplitInBatches に渡せる形に変換。
 * UploadFile の出力には binary が残るが json には PrepUpload で詰めた count/ids がある。
 */
export default function (): CodeNodeReturn {
  const upstream = $("PrepUpload").first().json as IDataObject;
  const ids = (upstream?.ids || []) as string[];

  // 各 id を 1 アイテムずつに展開 (SplitInBatches 用)
  return ids.map((id) => ({
    json: { id },
  }));
}
