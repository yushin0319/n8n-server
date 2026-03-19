export default function (): CodeNodeReturn {
  const d = $json;
  return [
    {
      json: {
        action: "update",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
