export default function (): CodeNodeReturn {
  const body = $json.body;
  const query = body.query || "";
  const mimeType = body.mime_type || "";
  const qParts = ["trashed = false"];
  if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`);
  if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
  const q = qParts.join(" and ");
  const fields =
    "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)";
  const pageSize = body.page_size || 20;
  return [{ json: { q, fields, pageSize } }];
}
