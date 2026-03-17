export default function (): CodeNodeReturn {
  const d = $json;
  return [{ json: { action: 'rename', success: true, id: d.id, name: d.name, url: d.webViewLink } }];
}
