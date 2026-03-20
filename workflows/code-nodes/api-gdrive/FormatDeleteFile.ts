export default function (): CodeNodeReturn {
  const fileId = $("PrepDeleteFile").first().json.file_id;
  return [{ json: { action: "deleteFile", success: true, file_id: fileId } }];
}
