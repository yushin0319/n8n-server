import { describe, expect, it, vi, beforeEach } from "vitest";
import formatShare from "./FormatShare";

describe("gdrive-share/FormatShare", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("共有結果を整形して返す", () => {
    vi.stubGlobal("$json", {
      id: "perm123",
      role: "reader",
      type: "anyone",
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { fileId: "file123" } }),
    }));

    const result = formatShare() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          action: "share",
          success: true,
          file_id: "file123",
          permission_id: "perm123",
          role: "reader",
          type: "anyone",
        },
      },
    ]);
  });
});
