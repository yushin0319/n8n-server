export default function (): CodeNodeReturn {
  // tracking-repos空の場合
  return [{ json: { requestBody: "[]", count: 0, releases: [] } }];
}
