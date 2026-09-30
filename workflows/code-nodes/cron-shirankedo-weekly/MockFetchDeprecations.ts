/** テストモード: 廃止一覧は取得せず、除外なしで進める */
export default function (): CodeNodeReturn {
  return [{ json: { deprecations: [], deprecationWarnings: [] } }];
}
