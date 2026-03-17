export default function (): CodeNodeReturn {
  const d = $input.first().json;
  const prep = $('PrepContent').first().json;
  return [{ json: { action: 'upload', success: true, id: d.id || prep.fileId, name: d.name || prep.name, url: prep.webViewLink } }];
}
