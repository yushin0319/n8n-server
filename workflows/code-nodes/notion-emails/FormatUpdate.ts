export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [{ json: { success: true, page_id: d.id } }];
}
