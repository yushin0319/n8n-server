export default function (): CodeNodeReturn {
  // AA の Free API (/api/v2/language/models/free) の 1 ページ目と同じ形の空の一覧
  return [
    {
      json: {
        tier: "free",
        pagination: {
          page: 1,
          page_size: 200,
          total_pages: 1,
          has_more: false,
        },
        data: [],
      },
    },
  ];
}
