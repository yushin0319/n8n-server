export default function (): CodeNodeReturn {
  // staticDataからPOST結果を読み出し
  const staticData = $getWorkflowStaticData("global");
  const results = (staticData.postResults as IDataObject) || {
    total: 0,
    errors: 0,
  };
  staticData.postResults = null;
  return [{ json: results }];
}
