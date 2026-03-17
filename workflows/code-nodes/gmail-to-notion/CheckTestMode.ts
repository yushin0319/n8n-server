import { checkTestMode } from "../_shared/checkTestMode";

export default function (): CodeNodeReturn {
  return checkTestMode($input.all(), $execution);
}
