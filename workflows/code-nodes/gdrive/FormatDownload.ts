export default function (): CodeNodeReturn {
  const item = $input.first();
  const fileId = $("PrepDownload").first().json.fileId;

  // BinaryToTextノードがバイナリ→UTF-8テキストに変換済み
  // setAllData=false, destinationKey="textContent" で json.textContent に格納
  // 注意: "content" は Code Node 予約語のため fileContent を使用
  const fileContent = item.json.textContent || JSON.stringify(item.json);

  return [
    { json: { action: "download", file_id: fileId, content: fileContent } },
  ];
}
