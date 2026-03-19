import { beforeEach, describe, expect, it, vi } from "vitest";
import prepShareFolder from "./PrepShareFolder";

describe("gdrive/PrepShareFolder", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("folder_idとデフォルトのrole/typeを抽出する", () => {
    vi.stubGlobal("$json", { body: { folder_id: "folder123" } });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json.folderId).toBe("folder123");
    expect(result[0].json.role).toBe("reader");
    expect(result[0].json.shareType).toBe("anyone");
  });

  it("role, type指定時はそれを使う", () => {
    vi.stubGlobal("$json", {
      body: {
        folder_id: "folder123",
        role: "writer",
        type: "user",
        email_address: "test@example.com",
      },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result[0].json.role).toBe("writer");
    expect(result[0].json.shareType).toBe("user");
    expect(result[0].json.emailAddress).toBe("test@example.com");
  });

  it("folder_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", { body: {} });

    expect(prepShareFolder()).toEqual([
      { json: { _error: true, message: "folder_id is required" } },
    ]);
  });

  it("type=userでemail_addressがない場合エラー", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", type: "user" },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          _error: true,
          message: "email_address is required when type is user or group",
        },
      },
    ]);
  });

  it("type=domainでdomainがない場合エラー", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", type: "domain" },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          _error: true,
          message: "domain is required when type is domain",
        },
      },
    ]);
  });

  it("type=domainでdomainが指定されている場合成功", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", type: "domain", domain: "example.com" },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          folderId: "folder123",
          role: "reader",
          shareType: "domain",
          domain: "example.com",
        },
      },
    ]);
  });

  it("type=anyoneではemailAddress/domainを含めない", () => {
    vi.stubGlobal("$json", {
      body: { folder_id: "folder123", type: "anyone" },
    });

    const result = prepShareFolder() as INodeExecutionData[];
    expect(result[0].json).not.toHaveProperty("emailAddress");
    expect(result[0].json).not.toHaveProperty("domain");
  });
});
