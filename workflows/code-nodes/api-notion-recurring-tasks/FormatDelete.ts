export default function (): CodeNodeReturn {
  // delete結果をフォーマット
  const page = $input.first().json;
  return [{ json: { action: "delete", success: true, id: page.id } }];
}
