export default function (): CodeNodeReturn {
  // ネイティブGoogle Drive Uploadノードの出力を直接読む
  const d = $input.first().json;
  return [
    {
      json: {
        action: "upload",
        success: true,
        id: d.id,
        name: d.name,
        url: d.webViewLink,
      },
    },
  ];
}
