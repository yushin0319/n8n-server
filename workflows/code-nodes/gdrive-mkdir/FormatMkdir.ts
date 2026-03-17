export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [
    {
      json: {
        action: "mkdir",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
