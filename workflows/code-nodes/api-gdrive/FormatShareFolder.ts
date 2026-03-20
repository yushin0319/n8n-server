export default function (): CodeNodeReturn {
  const perm = $json;
  const prep = $("PrepShareFolder").first().json;
  return [
    {
      json: {
        action: "shareFolder",
        success: true,
        folder_id: prep.folderId,
        permission_id: perm.id,
        role: perm.role,
        type: perm.type,
      },
    },
  ];
}
