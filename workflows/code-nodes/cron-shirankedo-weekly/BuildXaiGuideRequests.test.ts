import { describe, expect, it } from "vitest";
import { buildXaiGuideRequests } from "./BuildXaiGuideRequests";
import { XAI_INDEX_URL } from "./deprecations";

const LLMS_TXT =
  "- [Migration Guides — Model Retirement (May 15, 2026)](https://docs.x.ai/developers/migration/may-15-retirement.md)";

describe("buildXaiGuideRequests", () => {
  it("llms.txt の移行ガイドを取得対象にする", () => {
    expect(
      buildXaiGuideRequests([
        { vendor: "openai", statusCode: 200, body: "x" },
        { vendor: "xai-index", statusCode: 200, body: LLMS_TXT },
      ]),
    ).toEqual([
      {
        vendor: "xai",
        url: "https://docs.x.ai/developers/migration/may-15-retirement.md",
      },
    ]);
  });

  it.each([
    [[{ vendor: "xai-index", statusCode: 500 }], "llms.txt: HTTP 500"],
    [[{ vendor: "xai-index", error: {} }], "llms.txt: HTTP error"],
    [
      [{ vendor: "xai-index", statusCode: 200, body: "no links" }],
      "llms.txt に移行ガイドのリンクがありません",
    ],
    [[], "llms.txt の取得結果がありません"],
  ])("取れない場合も 1 件出力し理由を入れる（%#）", (pages, reason) => {
    expect(buildXaiGuideRequests(pages as IDataObject[])).toEqual([
      { vendor: "xai", url: XAI_INDEX_URL, indexError: reason },
    ]);
  });
});
