import { beforeEach, describe, expect, it, vi } from "vitest";
import prepUpload from "./PrepUpload";

describe("gdrive-upload/PrepUpload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("デフォルト値を適用する", () => {
    vi.stubGlobal("$json", { body: {} });

    const result = prepUpload() as INodeExecutionData[];
    expect(result).toEqual([
      {
        json: {
          name: "untitled.txt",
          fileContent: "",
          folderId: "root",
          mimeType: "text/plain",
          encoding: "utf-8",
        },
      },
    ]);
  });

  it("指定した値を使う", () => {
    vi.stubGlobal("$json", {
      body: {
        name: "report.pdf",
        content: "base64data",
        folder_id: "folder123",
        mime_type: "application/pdf",
        encoding: "base64",
      },
    });

    const result = prepUpload() as INodeExecutionData[];
    expect(result[0].json.name).toBe("report.pdf");
    expect(result[0].json.fileContent).toBe("base64data");
    expect(result[0].json.folderId).toBe("folder123");
    expect(result[0].json.mimeType).toBe("application/pdf");
    expect(result[0].json.encoding).toBe("base64");
  });
});
