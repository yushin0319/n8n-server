export default function (): CodeNodeReturn {
  // staticDataからリネーム情報を取り出してPOST用に整形
  const staticData = $getWorkflowStaticData("global");
  const renames = (staticData.renames || []) as IDataObject[];
  staticData.renames = [];

  if (renames.length === 0) {
    return [{ json: { renames: [], count: 0, skip: true } }];
  }

  return [
    {
      json: {
        requestBody: JSON.stringify({ renames }),
        count: renames.length,
        skip: false,
      },
    },
  ];
}
