export default function (): CodeNodeReturn {
  const prep = $("PrepNotify").first().json;
  const notion = $input.first().json as IDataObject;

  // critical 以外は IfSendDiscordNow で SendDiscord を通らない。
  // 未実行ノードを $() で参照すると throw するため、先に分岐する。
  let discordResult: IDataObject;
  let discordOk: boolean;
  if (prep.sendDiscordNow === true) {
    const discord = $("SendDiscord").first().json as IDataObject;
    const discordStatus =
      typeof discord.statusCode === "number" ? discord.statusCode : null;
    discordOk =
      discordStatus !== null && discordStatus >= 200 && discordStatus < 300;
    discordResult = { ok: discordOk, status: discordStatus };
  } else {
    discordOk = true;
    discordResult = { ok: true, status: null, skipped: true };
  }
  const notionOk = notion.object !== "error" && Boolean(notion.id);

  return [
    {
      json: {
        success: discordOk && notionOk,
        severity: prep.severity,
        service: prep.service,
        channel: prep.channel,
        discord: discordResult,
        notion: {
          ok: notionOk,
          page_id: notion.id ?? null,
          error_code: notionOk ? null : (notion.code ?? null),
        },
      },
    },
  ];
}
