export default function (): CodeNodeReturn {
  const upstream = $("PrepUpload").first().json as IDataObject;
  return [
    {
      json: {
        status: "ok",
        workflow: "db-archive-execution",
        test: true,
        timestamp: new Date().toISOString(),
        message: "スモークテスト正常終了",
        archived_count: upstream?.count || 0,
      },
    },
  ];
}
