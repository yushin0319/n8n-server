export default function (): CodeNodeReturn {
  // update結果をフォーマット
  const page = $input.first().json;
  return [
    { json: { action: "update", success: true, id: page.id, url: page.url } },
  ];
}
