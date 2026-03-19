import { beforeEach, describe, expect, it, vi } from "vitest";
import formatCopy from "./FormatCopy";

describe("gdrive/FormatCopy", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("コピー成功レスポンスを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          id: "newfile456",
          name: "Copy of original.txt",
          webViewLink: "https://drive.google.com/file/newfile456",
        },
      }),
    });

    const result = formatCopy() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "copy",
      success: true,
      id: "newfile456",
      name: "Copy of original.txt",
      url: "https://drive.google.com/file/newfile456",
    });
  });
});
