interface NotionPage {
  id?: string;
  url?: string;
  created_time?: string;
}

export default function (): CodeNodeReturn {
  const page = $input.first().json as NotionPage;
  return [
    {
      json: {
        action: "create",
        id: page.id || null,
        url: page.url || null,
        created_time: page.created_time || null,
      },
    },
  ];
}
