import { beforeEach, describe, expect, it, vi } from "vitest";
import formatDownload from "./FormatDownload";

describe("gdrive-download/FormatDownload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("getBinaryDataBufferでバイナリを読み取りUTF-8に変換する", async () => {
    const mockBuffer = Buffer.from("file content here");
    const context = {
      helpers: {
        getBinaryDataBuffer: vi.fn().mockResolvedValue(mockBuffer),
      },
    };
    vi.stubGlobal("$input", {
      first: () => ({ json: {} }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { fileId: "abc123" } }),
    }));

    const result = (await formatDownload.call(context)) as INodeExecutionData[];
    expect(result).toHaveLength(1);
    expect(result[0].json).toEqual({
      action: "download",
      file_id: "abc123",
      content: "file content here",
    });
  });

  it("helpers失敗時はJSONフォールバック", async () => {
    const context = {
      helpers: {
        getBinaryDataBuffer: vi
          .fn()
          .mockRejectedValue(new Error("not available")),
      },
    };
    vi.stubGlobal("$input", {
      first: () => ({ json: { foo: "bar" } }),
    });
    vi.stubGlobal("$", (_name: string) => ({
      first: () => ({ json: { fileId: "abc123" } }),
    }));

    const result = (await formatDownload.call(context)) as INodeExecutionData[];
    expect(result[0].json.content).toBe('{"foo":"bar"}');
  });
});
