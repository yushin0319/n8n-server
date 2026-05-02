import { describe, expect, it } from "vitest";
import testResponse from "./TestResponse";

describe("TestResponse", () => {
  it("status=ok / workflow=db-archive-execution / test=true を返す", () => {
    const result = testResponse();
    const item = (Array.isArray(result) ? result[0] : result) as {
      json: {
        status: string;
        workflow: string;
        test: boolean;
        timestamp: string;
        message: string;
      };
    };
    expect(item.json.status).toBe("ok");
    expect(item.json.workflow).toBe("db-archive-execution");
    expect(item.json.test).toBe(true);
    expect(item.json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(item.json.message).toContain("正常終了");
  });
});
