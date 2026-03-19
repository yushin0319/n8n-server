export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [
    {
      json: {
        action: "copy",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
