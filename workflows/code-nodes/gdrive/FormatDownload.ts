export default function (): CodeNodeReturn {
  const item = $input.first();
  const fileId = $("PrepDownload").first().json.file_id;

  // ネイティブGoogle Driveノードはバイナリでファイル内容を返す
  // 注意: "content" は Code Node 予約語のため fileContent を使用
  let fileContent: unknown;
  if (item.binary?.data?.data) {
    fileContent = Buffer.from(
      item.binary.data.data as string,
      "base64",
    ).toString("utf-8");
  } else {
    fileContent = JSON.stringify(item.json);
  }

  return [
    { json: { action: "download", file_id: fileId, content: fileContent } },
  ];
}
