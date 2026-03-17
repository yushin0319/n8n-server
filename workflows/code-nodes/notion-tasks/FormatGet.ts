export default function (): CodeNodeReturn {
  const pageId = $("PrepGet").first().json.pageId as string;
  const blocksResult = $input.first().json;
  const blocks = ((blocksResult.results as IDataObject[]) || [])
    .map((block: IDataObject) => {
      const bType = block.type as string;
      let text = "";
      if ((block[bType] as IDataObject)?.rich_text) {
        text = ((block[bType] as IDataObject).rich_text as IDataObject[])
          .map((t: IDataObject) => t.plain_text)
          .join("");
      } else if (bType === "child_database") {
        text =
          "[child_database: " +
          ((block.child_database as IDataObject)?.title || "") +
          "]";
      } else if (bType === "image") {
        text = "[image]";
      } else if (bType === "divider") {
        text = "---";
      }
      return { type: bType, text };
    })
    .filter((b: { type: string; text: string }) => b.text);
  const textLines = blocks.map((b: { type: string; text: string }) => b.text).join("\n");
  return [
    {
      json: {
        action: "get",
        page_id: pageId,
        blocks,
        text_content: textLines,
      },
    },
  ];
}
