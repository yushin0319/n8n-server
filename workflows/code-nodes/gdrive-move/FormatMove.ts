export default function (): CodeNodeReturn {
  const d = $json;
  const prep = $('PrepMove').first().json;
  return [{ json: { action: 'move', success: true, id: d.id, name: d.name, url: d.webViewLink, folder_id: prep.folderId } }];
}
