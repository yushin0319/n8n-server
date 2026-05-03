export default function (): CodeNodeReturn {
  const prep = $("PrepNotify").first().json;
  const discord = $("SendDiscord").first().json as IDataObject;
  const notion = $input.first().json as IDataObject;

  const discordStatus =
    typeof discord.statusCode === "number" ? discord.statusCode : null;
  const discordOk =
    discordStatus !== null && discordStatus >= 200 && discordStatus < 300;
  const notionOk = notion.object !== "error" && Boolean(notion.id);

  return [
    {
      json: {
        success: discordOk && notionOk,
        severity: prep.severity,
        service: prep.service,
        channel: prep.channel,
        discord: { ok: discordOk, status: discordStatus },
        notion: {
          ok: notionOk,
          page_id: notion.id ?? null,
          error_code: notionOk ? null : (notion.code ?? null),
        },
      },
    },
  ];
}
