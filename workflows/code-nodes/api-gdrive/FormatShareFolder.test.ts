import { beforeEach, describe, expect, it, vi } from "vitest";
import formatShareFolder from "./FormatShareFolder";

describe("gdrive/FormatShareFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("フォルダ共有成功レスポンスを返す", () => {
    vi.stubGlobal("$json", {
      id: "perm789",
      role: "reader",
      type: "anyone",
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { folderId: "folder123" } }),
    }));

    const result = formatShareFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "shareFolder",
      success: true,
      folder_id: "folder123",
      permission_id: "perm789",
      role: "reader",
      type: "anyone",
    });
  });
});
