import { describe, expect, it } from "vitest";
import { stripHtmlTags } from "./stripHtmlTags";

describe("stripHtmlTags", () => {
  it("通常のHTMLタグを除去する", () => {
    expect(stripHtmlTags("<p>hello</p>")).toBe("hello");
  });

  it("複数タグを除去する", () => {
    expect(stripHtmlTags("<b>bold</b> and <i>italic</i>")).toBe(
      "bold and italic",
    );
  });

  it("入れ子の不正タグもループで除去する", () => {
    // <[^>]+> は < から最初の > までを消す
    // 1回のreplaceで残った断片が新たなタグを形成する場合、ループで除去
    // ループがCodeQL js/incomplete-multi-character-sanitization を解消する
    expect(stripHtmlTags("<div>nested <b>tags</b></div>")).toBe("nested tags");
    expect(stripHtmlTags("<<<b>>>")).toBe(">>");
  });

  it("属性付きタグを除去する", () => {
    expect(stripHtmlTags('<a href="url">link</a>')).toBe("link");
  });

  it("空文字・null・undefinedは空文字を返す", () => {
    expect(stripHtmlTags("")).toBe("");
    expect(stripHtmlTags(null as any)).toBe("");
    expect(stripHtmlTags(undefined as any)).toBe("");
  });

  it("タグのないテキストはそのまま返す", () => {
    expect(stripHtmlTags("plain text")).toBe("plain text");
  });
});
