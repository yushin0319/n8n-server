export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [
    {
      json: {
        action: "createFolder",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
