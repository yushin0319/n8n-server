import { beforeEach, describe, expect, it, vi } from "vitest";
import extractMessageIds from "./ExtractMessageIds";

describe("ExtractMessageIds", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("BuildNotionBodyの出力からmessageIdを抽出する", () => {
    vi.stubGlobal("$", (_name: string) => ({
      all: () => [
        { json: { requestBody: "{}", messageId: "msg-1" } },
        { json: { requestBody: "{}", messageId: "msg-2" } },
      ],
    }));

    const result = extractMessageIds() as INodeExecutionData[];
    expect(result).toHaveLength(2);
    expect(result[0].json.messageId).toBe("msg-1");
    expect(result[1].json.messageId).toBe("msg-2");
  });
});
