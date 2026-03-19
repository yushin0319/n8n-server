export default function (): CodeNodeReturn {
  const item = $input.first();
  const fileId = $("PrepDownload").first().json.file_id;

  // BinaryToTextノードがバイナリ→UTF-8テキストに変換済み
  // $json.data にテキスト内容が入っている
  const fileContent = item.json.data || JSON.stringify(item.json);

  return [
    { json: { action: "download", file_id: fileId, content: fileContent } },
  ];
}
