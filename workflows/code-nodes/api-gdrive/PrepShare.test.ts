import { beforeEach, describe, expect, it, vi } from "vitest";
import prepShare from "./PrepShare";

describe("gdrive-share/PrepShare", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("file_idを抽出しデフォルト値を適用する", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      { json: { fileId: "file123", role: "reader", shareType: "anyone" } },
    ]);
  });

  it("roleとtypeを指定できる", () => {
    vi.stubGlobal("$json", {
      body: {
        file_id: "file123",
        role: "writer",
        type: "user",
        email_address: "test@example.com",
      },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          fileId: "file123",
          role: "writer",
          shareType: "user",
          emailAddress: "test@example.com",
        },
      },
    ]);
  });

  it("file_idがない場合エラーオブジェクトを返す", () => {
    vi.stubGlobal("$json", {
      body: { role: "reader" },
    });

    expect(prepShare()).toEqual([
      { json: { _error: true, message: "file_id is required" } },
    ]);
  });

  it("type=userでemail_addressがない場合エラー", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", type: "user" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          _error: true,
          message: "email_address is required when type is user or group",
        },
      },
    ]);
  });

  it("type=groupでemail_addressがない場合エラー", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", type: "group" },
    });

    const result = prepShare() as INodeExecutionData[];
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
      body: { file_id: "file123", type: "domain" },
    });

    const result = prepShare() as INodeExecutionData[];
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
      body: { file_id: "file123", type: "domain", domain: "example.com" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          fileId: "file123",
          role: "reader",
          shareType: "domain",
          domain: "example.com",
        },
      },
    ]);
  });

  it("type=anyoneではemailAddress/domainを含めない", () => {
    vi.stubGlobal("$json", {
      body: { file_id: "file123", type: "anyone" },
    });

    const result = prepShare() as INodeExecutionData[];
    expect(result[0].json).not.toHaveProperty("emailAddress");
    expect(result[0].json).not.toHaveProperty("domain");
  });
});
