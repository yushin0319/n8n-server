export default function (): CodeNodeReturn {
  const data = $json;
  const files = ((data.files as IDataObject[]) || []).map(
    (f: IDataObject) => ({
      id: f.id,
      name: f.name,
      type: f.mimeType,
      size: f.size ? parseInt(f.size as string) : null,
      modified: f.modifiedTime,
      url: f.webViewLink,
    }),
  );
  return [
    {
      json: {
        action: "list",
        count: files.length,
        next_page_token: data.nextPageToken || null,
        files,
      },
    },
  ];
}
