import { beforeEach, describe, expect, it, vi } from "vitest";
import prepCreateText from "./PrepCreateText";

describe("gdrive/PrepCreateText", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("contentを必須パラメータとして抽出する", () => {
    vi.stubGlobal("$json", { body: { content: "hello world" } });

    const result = prepCreateText() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.content).toBe("hello world");
    expect(result[0].json.name).toBe("Untitled");
    expect(result[0].json.folderId).toBe("root");
  });

  it("name, folder_id指定時はそれを使う", () => {
    vi.stubGlobal("$json", {
      body: { content: "data", name: "memo.txt", folder_id: "folder789" },
    });

    const result = prepCreateText() as INodeExecutionData[];
    expect(result[0].json.name).toBe("memo.txt");
    expect(result[0].json.folderId).toBe("folder789");
  });

  it("contentがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepCreateText()).toEqual([
      { json: { _error: true, message: "content is required" } },
    ]);
  });
});
