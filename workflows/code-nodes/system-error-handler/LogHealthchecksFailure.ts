export default function (): CodeNodeReturn {
  const err = $input.first().json;
  const original = $("FormatError").first().json;
  console.error(
    "Healthchecks.io fail ping 送信失敗 - 元エラー:",
    JSON.stringify(original.embed || {}),
  );
  console.error(
    "Healthchecks 送信エラー:",
    err.error?.message || err.message || JSON.stringify(err).substring(0, 200),
  );
  return [{ json: { healthchecksFailed: true } }];
}
