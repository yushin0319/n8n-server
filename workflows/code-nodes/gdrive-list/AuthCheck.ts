import { authCheck } from "../_shared/authCheck";

export default function (): CodeNodeReturn {
  return authCheck($input.all(), $env.WEBHOOK_SECRET);
}
