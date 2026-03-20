import { beforeEach, describe, expect, it, vi } from "vitest";
import formatCreateText from "./FormatCreateText";

describe("gdrive/FormatCreateText", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("テキストファイル作成成功レスポンスを返す", () => {
    vi.stubGlobal("$input", {
      first: () => ({
        json: {
          id: "file789",
          name: "memo.txt",
          webViewLink: "https://drive.google.com/file/file789",
        },
      }),
    });

    const result = formatCreateText() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "createFromText",
      success: true,
      id: "file789",
      name: "memo.txt",
      url: "https://drive.google.com/file/file789",
    });
  });
});
