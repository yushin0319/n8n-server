export default function (): CodeNodeReturn {
  const folderId = $("PrepDeleteFolder").first().json.folder_id;
  return [
    { json: { action: "deleteFolder", success: true, folder_id: folderId } },
  ];
}
