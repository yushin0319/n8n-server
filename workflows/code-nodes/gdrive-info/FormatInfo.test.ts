import { beforeEach, describe, expect, it, vi } from "vitest";
import formatInfo from "./FormatInfo";

describe("gdrive-info/FormatInfo", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("action: infoと元データをマージして返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: { id: "abc123", name: "test.txt", mimeType: "text/plain" },
      }),
    });

    const result = formatInfo() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.action).toBe("info");
    expect(result[0].json.id).toBe("abc123");
    expect(result[0].json.name).toBe("test.txt");
  });
});
