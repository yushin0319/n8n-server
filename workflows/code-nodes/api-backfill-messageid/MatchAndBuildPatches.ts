import {
  notionDate,
  notionRichText,
  notionTitle,
} from "../_shared/notionProps";

/**
 * one-time backfill: Notion emails DB の messageId 空エントリを
 * Gmail の subject + date(±5min) で逆引きして PATCH 候補を組み立てる。
 *
 * 出力方針:
 * - test:true または matched=0 → サマリー 1 件 (type: "summary" 付与、下流 IF が分岐)
 * - それ以外 → 各マッチを 1 アイテムずつ出力 (pageId, messageId, subject, date)
 */
export default function (): CodeNodeReturn {
  const gmailItems = $("GmailGetMany").all();
  const notionItems = $input.all();
  const webhookBody = $("Webhook").first()?.json?.body as
    | IDataObject
    | undefined;
  const isTest = webhookBody?.test === true;

  const gmailIdx = new Map<string, Array<{ id: string; tsMs: number }>>();
  for (const item of gmailItems) {
    const e = (item.json ?? {}) as IDataObject;
    const id = e.id as string | undefined;
    if (!id) continue;
    const subject = ((e.Subject ?? e.subject) as string | undefined) ?? "";
    const key = subject.trim();
    const tsMs = Number(e.internalDate ?? 0);
    const bucket = gmailIdx.get(key) ?? [];
    bucket.push({ id, tsMs });
    gmailIdx.set(key, bucket);
  }

  const WINDOW_MS = 5 * 60 * 1000;
  const matches: Array<{
    pageId: string;
    messageId: string;
    subject: string;
    date: string;
  }> = [];
  let skippedAlreadySet = 0;
  let skippedNoMatch = 0;

  for (const page of notionItems) {
    const json = (page.json ?? {}) as IDataObject;
    const pageId = json.id as string | undefined;
    const props = (json.properties as IDataObject | undefined) ?? {};
    if (!pageId) continue;

    if (notionRichText(props, "messageId")) {
      skippedAlreadySet++;
      continue;
    }

    const subject = notionTitle(props, "subject", "");
    const dateStr = notionDate(props, "date");
    if (!subject || !dateStr) {
      skippedNoMatch++;
      continue;
    }
    const dateMs = new Date(dateStr).getTime();
    const candidates = gmailIdx.get(subject.trim()) ?? [];
    const match = candidates.find(
      (c) => Math.abs(c.tsMs - dateMs) <= WINDOW_MS,
    );
    if (!match) {
      skippedNoMatch++;
      continue;
    }
    matches.push({
      pageId,
      messageId: match.id,
      subject,
      date: dateStr,
    });
  }

  const buildSummary = () => ({
    json: {
      type: "summary" as const,
      status: "ok",
      test: isTest,
      matched: matches.length,
      skippedAlreadySet,
      skippedNoMatch,
      gmailCount: gmailItems.length,
      notionCount: notionItems.length,
      samples: matches.slice(0, 50),
    },
  });

  if (isTest || matches.length === 0) {
    return [buildSummary()];
  }

  return matches.map((m) => ({ json: m }));
}
