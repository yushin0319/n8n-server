export default function (): CodeNodeReturn {
  const msg = $input.first().json;
  const message = msg.body.message || "No message provided";
  return [{ json: { message } }];
}
