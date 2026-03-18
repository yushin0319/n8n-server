import { describe, expect, it } from "vitest";
import { sanitizeForPrompt } from "./sanitizeForPrompt";

describe("sanitizeForPrompt", () => {
  it("改行・制御文字をスペースに置換する", () => {
    expect(sanitizeForPrompt("line1\nline2\rline3")).toBe("line1 line2 line3");
  });

  it("連続スペースを1つにまとめる", () => {
    expect(sanitizeForPrompt("a   b  c")).toBe("a b c");
  });

  it("デフォルト500文字で切り詰める", () => {
    const long = "a".repeat(600);
    expect(sanitizeForPrompt(long)).toHaveLength(500);
  });

  it("maxLengthを指定できる", () => {
    const long = "a".repeat(200);
    expect(sanitizeForPrompt(long, 100)).toHaveLength(100);
  });

  it("null/undefined/空文字は空文字を返す", () => {
    expect(sanitizeForPrompt("")).toBe("");
    expect(sanitizeForPrompt(null as any)).toBe("");
    expect(sanitizeForPrompt(undefined as any)).toBe("");
  });

  it("前後の空白をtrimする", () => {
    expect(sanitizeForPrompt("  hello  ")).toBe("hello");
  });

  it("タブ文字をスペースに置換する", () => {
    expect(sanitizeForPrompt("col1\tcol2")).toBe("col1 col2");
  });
});
