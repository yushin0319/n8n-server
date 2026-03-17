export default function (): CodeNodeReturn {
  // arXiv APIエラー時: 空データを返してパイプライン続行
  return [
    {
      json: {
        title: "arXiv empty",
        url: "",
        description: "",
        source: "arxiv",
      },
    },
  ];
}
