export default function (): CodeNodeReturn {
  const prepItems = $('BuildNotionBody').all();
  return prepItems.map(item => ({
    json: { messageId: item.json.messageId }
  }));
}
