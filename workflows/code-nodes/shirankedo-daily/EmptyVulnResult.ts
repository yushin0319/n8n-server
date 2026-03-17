export default function (): CodeNodeReturn {
  // 0件の場合: 空配列でフォーマット
  return [{ json: { requestBody: "[]", count: 0, vulnerabilities: [] } }];
}
