export default function (): CodeNodeReturn {
  let hasContent = false;
  let pageId: string | null = null;
  try {
    const prepData = $("PrepAppend").first().json;
    hasContent = !!prepData.hasContent;
    pageId = prepData.pageId as string;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error("PrepAppend取得エラー: " + msg);
  }

  const data = $input.first().json;
  const contentAppended = hasContent && data.object === "list";

  return [
    {
      json: {
        action: "update",
        success: true,
        id: pageId,
        url: pageId
          ? "https://www.notion.so/" + pageId.replace(/-/g, "")
          : null,
        hasContent,
        contentAppended,
      },
    },
  ];
}
