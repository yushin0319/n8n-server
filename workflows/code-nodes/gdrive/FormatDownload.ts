export default function (): CodeNodeReturn {
  const item = $input.first();
  const fileId = $("PrepDownload").first().json.fileId;

  // ネイティブGoogle Driveノードはバイナリでファイル内容を返す
  // 注意: "content" は Code Node 予約語のため fileContent を使用
  let fileContent: unknown;
  const raw = item.binary?.data?.data as string | undefined;
  if (raw) {
    // base64文字列かどうか判定（A-Za-z0-9+/=のみならbase64）
    const isBase64 = /^[A-Za-z0-9+/\n\r]+=*$/.test(raw);
    fileContent = isBase64 ? Buffer.from(raw, "base64").toString("utf-8") : raw;
  } else {
    fileContent = JSON.stringify(item.json);
  }

  return [
    { json: { action: "download", file_id: fileId, content: fileContent } },
  ];
}
