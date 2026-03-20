export default function (): CodeNodeReturn {
  // テストモード判定: body.test === true なら isTest フラグをセット
  const body = $input.first().json.body;
  const isTest = body?.test === true;
  $execution.customData.set("isTest", isTest ? "true" : "false");
  return $input.all();
}
