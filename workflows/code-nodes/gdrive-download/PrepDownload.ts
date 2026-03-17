import { prepParams } from "../_shared/prepParams";

export default function (): CodeNodeReturn {
  const params = prepParams($json.body, { required: ["file_id"] });
  return [{ json: params }];
}
