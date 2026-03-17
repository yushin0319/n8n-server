export default function (): CodeNodeReturn {
  const d = $input.first().json;
  return [{ json: { action: "info", ...d } }];
}
