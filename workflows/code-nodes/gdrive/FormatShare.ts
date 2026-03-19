export default function (): CodeNodeReturn {
  const perm = $json;
  const prep = $("PrepShare").first().json;
  return [
    {
      json: {
        action: "share",
        success: true,
        file_id: prep.fileId,
        permission_id: perm.id,
        role: perm.role,
        type: perm.type,
      },
    },
  ];
}
