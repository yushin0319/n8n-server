/**
 * MatchAndBuildPatches の各候補 item から Notion PATCH 用 body を組み立て、
 * pageId を引き回す。HTTP Request ノードは $json.requestBody を使う。
 */
export default function (): CodeNodeReturn {
  return $input.all().map((item) => {
    const pageId = item.json?.pageId as string;
    const messageId = item.json?.messageId as string;
    const requestBody = JSON.stringify({
      properties: {
        messageId: {
          rich_text: [{ text: { content: messageId } }],
        },
      },
    });
    return {
      json: {
        pageId,
        messageId,
        subject: item.json?.subject,
        requestBody,
      },
    };
  });
}
