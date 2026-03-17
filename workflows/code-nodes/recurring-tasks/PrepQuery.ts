export default function (): CodeNodeReturn {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const queryBody = JSON.stringify({
    filter: {
      and: [
        { property: '有効', checkbox: { equals: true } },
        { property: '次回予定日', date: { on_or_before: today } }
      ]
    }
  });
  return [{ json: { requestBody: queryBody } }];
}
