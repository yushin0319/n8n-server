import { describe, expect, it } from "vitest";
import { COVERS, randomCover } from "./covers";

describe("COVERS", () => {
  it("20件のURLが定義されている", () => {
    expect(COVERS).toHaveLength(20);
  });

  it("全てhttps://で始まる", () => {
    for (const url of COVERS) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe("randomCover", () => {
  it("COVERS配列の要素の1つを返す", () => {
    const cover = randomCover();
    expect(COVERS).toContain(cover);
  });
});
