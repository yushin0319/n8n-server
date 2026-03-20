export default function (): CodeNodeReturn {
  // create結果をフォーマット
  const page = $input.first().json;
  return [
    { json: { action: "create", success: true, id: page.id, url: page.url } },
  ];
}
