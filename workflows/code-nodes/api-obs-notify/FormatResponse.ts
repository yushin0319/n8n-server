export default function (): CodeNodeReturn {
  const prep = $("PrepNotify").first().json;
  const notion = $input.first().json as IDataObject;

  // critical 以外は IfSendDiscordNow で SendDiscord を通らない（未実行ノードを $() で
  // 参照すると throw するため先に分岐する）。critical なのに通らなかった = URL 未設定で
  // 起こすべき通知が出ていないので ok=false にする。
  let discord: IDataObject;
  if (prep.sendDiscordNow === true) {
    const res = $("SendDiscord").first().json as IDataObject;
    const status = typeof res.statusCode === "number" ? res.statusCode : null;
    discord = { ok: status !== null && status >= 200 && status < 300, status };
  } else {
    discord = { ok: prep.severity !== "critical", status: null, skipped: true };
  }
  const notionOk = notion.object !== "error" && Boolean(notion.id);

  return [
    {
      json: {
        success: discord.ok === true && notionOk,
        severity: prep.severity,
        service: prep.service,
        channel: prep.channel,
        discord,
        notion: {
          ok: notionOk,
          page_id: notion.id ?? null,
          error_code: notionOk ? null : (notion.code ?? null),
        },
      },
    },
  ];
}
