export default function (): CodeNodeReturn {
  const data = $json;
  const files = (data.files || []).map((f: IDataObject) => ({
    id: f.id,
    name: f.name,
    type: f.mimeType,
    size: f.size ? parseInt(f.size) : null,
    modified: f.modifiedTime,
    url: f.webViewLink,
    parents: f.parents
  }));
  return [{ json: { action: 'search', count: files.length, files } }];
}
