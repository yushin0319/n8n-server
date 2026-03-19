import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, {
    required: ["name"],
    optional: { parent_id: "root" },
  });
  if (params._error) return [{ json: params }];
  return [
    {
      json: {
        name: params.name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [params.parent_id],
      },
    },
  ];
}
