export default function (): CodeNodeReturn {
  // PrepUploadの出力を直接受け取る（CreateEmpty廃止）
  const name = $json.name as string;
  const fileContent = $json.fileContent as string;
  const folderId = $json.folderId as string;
  const mimeType = $json.mimeType as string;
  const encoding = ($json.encoding as string) || "utf-8";

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
  const binaryData = Buffer.from(fileContent, encoding as BufferEncoding);

  return [
    {
      json: { name, folderId, mimeType },
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
