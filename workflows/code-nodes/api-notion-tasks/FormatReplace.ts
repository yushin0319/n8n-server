export default function (): CodeNodeReturn {
  const pageId = $("PrepReplace").first().json.pageId;
  return [
    {
      json: {
        action: "replace",
        success: true,
        id: pageId,
        url: "https://www.notion.so/" + pageId.replace(/-/g, ""),
      },
    },
  ];
}
