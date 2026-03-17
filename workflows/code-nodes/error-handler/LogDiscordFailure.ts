export default function (): CodeNodeReturn {
  const err = $input.first().json;
  const originalError = $('FormatError').first().json;
  console.error('Discord通知送信失敗 - 元エラー:', JSON.stringify(originalError.embed || {}));
  console.error('Discord送信エラー:', err.error?.message || err.message || JSON.stringify(err).substring(0, 200));
  return [{ json: { discordFailed: true } }];
}
