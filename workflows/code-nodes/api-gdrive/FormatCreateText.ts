export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [
    {
      json: {
        action: "createFromText",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
