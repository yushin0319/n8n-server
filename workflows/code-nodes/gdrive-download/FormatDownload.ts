export default function (): CodeNodeReturn {
  // n8n wraps raw text response in { data: "..." }
  const raw = $json;
  let content: unknown;
  if (raw.data !== undefined) {
    content = raw.data;
  } else if (typeof raw === "string") {
    content = raw;
  } else {
    content = JSON.stringify(raw);
  }
  const fileId = $("PrepDownload").first().json.file_id;
  return [{ json: { action: "download", file_id: fileId, content } }];
}
