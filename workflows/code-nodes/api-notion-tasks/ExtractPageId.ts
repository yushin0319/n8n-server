export default function (): CodeNodeReturn {
  const json = $input.first().json as IDataObject;
  const results = (json.results as IDataObject[]) || [];
  const taskId = ($("PrepGetByTaskId").first().json.taskId as number) ?? null;

  if (results.length === 0) {
    throw new Error(
      `task_id ${taskId ?? "?"} に一致するタスクが見つかりません`,
    );
  }

  const page = results[0];
  return [{ json: { pageId: page.id as string, taskId } }];
}
