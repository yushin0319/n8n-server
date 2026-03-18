export default function (): CodeNodeReturn {
  const data = $input.first().json;
  return [
    {
      json: {
        action: "create",
        success: !!data.id,
        id: data.id || null,
        url: data.url || null,
      },
    },
  ];
}
