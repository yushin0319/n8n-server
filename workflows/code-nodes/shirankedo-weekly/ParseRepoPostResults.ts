export default function (): CodeNodeReturn {
  const staticData = $getWorkflowStaticData("global");
  const results = (staticData.repoPostResults as IDataObject) || {
    total: 0,
    errors: 0,
  };
  staticData.repoPostResults = null;
  // 新規リポのstar情報を取り出してrepo-stats POST用に整形
  const newStars = (staticData.newRepoStars || []) as IDataObject[];
  staticData.newRepoStars = null;
  return [
    {
      json: {
        ...results,
        starRequestBody: JSON.stringify(newStars),
        starCount: newStars.length,
      },
    },
  ];
}
