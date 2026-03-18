export default function (): CodeNodeReturn {
  const fileContent = $("PrepUpload").first().json.fileContent;
  const fileId = $json.id;
  const name = $json.name;
  const webViewLink = $json.webViewLink;
  const mimeType = $("PrepUpload").first().json.mimeType;
  const encoding = $("PrepUpload").first().json.encoding || "utf-8";

  // Size limit check (5MB) to prevent memory exhaustion
  const MAX_SIZE = 5 * 1024 * 1024;
  const contentSize =
    encoding === "base64"
      ? Math.ceil((fileContent.length * 3) / 4)
      : fileContent.length;
  if (contentSize > MAX_SIZE) {
    throw new Error(
      "Content too large: " +
        Math.round(contentSize / 1024 / 1024) +
        "MB exceeds 5MB limit",
    );
  }

  // Create binary data from content (supports utf-8 for text, base64 for binary)
  const binaryData = Buffer.from(fileContent, encoding);

  return [
    {
      json: { fileId, name, webViewLink, mimeType },
      binary: {
        file: {
          data: binaryData.toString("base64"),
          mimeType: mimeType,
          fileName: name,
        },
      },
    },
  ];
}
