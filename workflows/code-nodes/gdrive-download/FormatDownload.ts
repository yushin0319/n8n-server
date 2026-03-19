export default function (): CodeNodeReturn {
  const item = $input.first();
  const fileId = $("PrepDownload").first().json.file_id;

  // ネイティブGoogle Driveノードはバイナリでファイル内容を返す
  let content: unknown;
  if (item.binary?.data?.data) {
    content = Buffer.from(item.binary.data.data as string, "base64").toString(
      "utf-8",
    );
  } else {
    content = JSON.stringify(item.json);
  }

  return [{ json: { action: "download", file_id: fileId, content } }];
}
