import { describe, expect, it, vi, beforeEach } from "vitest";
import emptyVulnResult from "./EmptyVulnResult";

function callAndGetItems() {
  const result = emptyVulnResult();
  const items = Array.isArray(result) ? result : [result];
  return items as INodeExecutionData[];
}

describe("EmptyVulnResult", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("count が 0 を返す", () => {
    const items = callAndGetItems();
    expect(items[0].json.count).toBe(0);
  });

  it("requestBody が '[]' を返す", () => {
    const items = callAndGetItems();
    expect(items[0].json.requestBody).toBe("[]");
  });
});
