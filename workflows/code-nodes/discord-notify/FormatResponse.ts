export default function (): CodeNodeReturn {
  const original = $('FormatDiscord').first().json;
  return [{ json: { success: true, message: original.message } }];
}
