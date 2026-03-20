export default function (): CodeNodeReturn {
  // SplitInBatches完了後: staticDataから蓄積リリースを取得
  const staticData = $getWorkflowStaticData("global") as IDataObject;
  const releases = (staticData.releases as IDataObject[]) || [];
  staticData.releases = [];
  return [
    {
      json: {
        requestBody: JSON.stringify(releases),
        count: releases.length,
        releases,
      },
    },
  ];
}
