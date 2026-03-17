export default function (): CodeNodeReturn {
  const fileId = $("PrepDelete").first().json.file_id;
  return [{ json: { action: "delete", success: true, file_id: fileId } }];
}
