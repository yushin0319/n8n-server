import { beforeEach, describe, expect, it, vi } from "vitest";
import emptyRepoResult from "./EmptyRepoResult";

describe("EmptyRepoResult", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("正しいスキップメッセージを返す", () => {
    const result = emptyRepoResult() as INodeExecutionData[];
    expect(result[0].json.message).toBe("新規リポなし、スキップ");
  });
});
