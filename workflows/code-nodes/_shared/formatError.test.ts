import { describe, expect, it } from "vitest";
import { formatError } from "./formatError";

describe("formatError", () => {
  it("文字列はそのまま返す", () => {
    expect(formatError("API timeout")).toBe("API timeout");
  });

  it("null/undefined は unknown", () => {
    expect(formatError(null)).toBe("unknown");
    expect(formatError(undefined)).toBe("unknown");
  });

  it("status + code + message を結合する", () => {
    const err = {
      status: 500,
      code: "ERR_BAD_RESPONSE",
      message: "Internal error",
      stack: "at ...\n".repeat(200),
    };
    const out = formatError(err);
    expect(out).toContain("500");
    expect(out).toContain("ERR_BAD_RESPONSE");
    expect(out).toContain("Internal error");
    expect(out).not.toContain("at ...");
  });

  it("statusCode も status と同様に扱う", () => {
    expect(formatError({ statusCode: 404, message: "Not found" })).toContain(
      "404",
    );
  });

  it("message が無い場合は JSON 要約から stack を除外する", () => {
    const err = {
      name: "AxiosError",
      stack: "stack-trace-should-not-appear",
    };
    const out = formatError(err);
    expect(out).not.toContain("stack-trace-should-not-appear");
    expect(out).toContain("AxiosError");
  });

  it("長すぎる文字列は切り詰める", () => {
    const long = "a".repeat(1000);
    const out = formatError(long, 100);
    expect(out.length).toBe(100);
    expect(out.endsWith("…")).toBe(true);
  });

  it("エラーオブジェクト全体も maxLen で切り詰められる", () => {
    const err = {
      status: 500,
      message: "x".repeat(5000),
      stack: "y".repeat(5000),
    };
    const out = formatError(err, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.startsWith("500:")).toBe(true);
  });

  it("input.error に文字列が入っているケース", () => {
    expect(formatError({ error: "Validation failed" })).toContain(
      "Validation failed",
    );
  });
});
