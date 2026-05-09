const TASKS_DB_ID = "2a02570f-e49f-802b-a67c-fe4c230a5699";

export default function (): CodeNodeReturn {
  const input = $input.first().json.body || $input.first().json;
  const taskId = (input as IDataObject).task_id;
  if (typeof taskId !== "number" || !Number.isFinite(taskId)) {
    throw new Error("task_id (number) is required for get_by_task_id action");
  }

  const filter = {
    property: "ID",
    unique_id: { equals: taskId },
  };

  return [
    {
      json: {
        url: `https://api.notion.com/v1/databases/${TASKS_DB_ID}/query`,
        requestBody: JSON.stringify({ filter, page_size: 1 }),
        taskId,
      },
    },
  ];
}
